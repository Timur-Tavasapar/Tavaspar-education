"""Browser smoke tests. Run: python -m unittest discover -s tests -p smoke.py -v."""
import functools
import os
from pathlib import Path
import shutil
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import threading
import unittest

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


class SmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Serve under a repository prefix, as on GitHub Pages project sites.
        handler = functools.partial(QuietHandler, directory=str(ROOT.parent))
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.addClassCleanup(cls.server.server_close)
        cls.addClassCleanup(cls.server.shutdown)
        cls.base_url = f'http://127.0.0.1:{cls.server.server_port}/{ROOT.name}/'
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        executable = os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium')
        cls.browser = cls.playwright.chromium.launch(
            headless=True, executable_path=executable)
        cls.addClassCleanup(cls.browser.close)
        print(f'\nChromium {cls.browser.version}; base URL: {cls.base_url}', flush=True)

    def setUp(self):
        self.context = self.browser.new_context(
            viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
        self.addCleanup(self.context.close)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.on('console', lambda m: self.errors.append(m.text)
                     if m.type == 'error' else None)
        self.page.on('requestfailed', lambda r: self.errors.append(r.url))
        self.page.on('response', lambda r: self.errors.append(f'{r.status} {r.url}')
                     if r.status >= 400 else None)

    def tearDown(self):
        self.assertEqual(self.errors, [], 'Browser or resource errors')

    def go(self, route):
        self.page.goto(self.base_url + '#' + route)
        self.page.evaluate('document.fonts.ready')

    def test_routes_and_reload(self):
        routes = [('/', 'home-view'), ('/directions', 'home-view'),
                  ('/course/oge', 'course-view'), ('/course/base', 'course-view'),
                  ('/course/profile', 'course-view'), ('/about', 'about-view'),
                  ('/lesson/powers', 'lesson-view'), ('/account', 'account-view'),
                  ('/missing', 'not-found-view')]
        for width in (390, 1440):
            self.page.set_viewport_size({'width': width, 'height': 900})
            for route, view in routes:
                with self.subTest(width=width, route=route):
                    self.go(route)
                    expect(self.page.locator('#' + view)).to_be_visible()
                    expect(self.page.locator('.site-view:visible')).to_have_count(1)
                    self.page.reload()
                    expect(self.page.locator('#' + view)).to_be_visible()
                    self.assertTrue(self.page.evaluate(
                        'document.documentElement.scrollWidth <= innerWidth'))
                    self.assertTrue(self.page.evaluate(
                        '[...document.images].every(i => i.complete && i.naturalWidth > 0)'))

    def test_lesson_and_navigation(self):
        self.go('/')
        self.page.locator('.hero-actions a').first.click()
        expect(self.page.locator('#courses-title')).to_be_focused()
        self.page.locator('a[href="#/course/oge"]').click()
        expect(self.page.locator('#course-title')).to_have_text('Подготовка к ОГЭ')
        self.page.go_back()
        expect(self.page.locator('#home-view')).to_be_visible()
        self.page.go_forward()
        expect(self.page.locator('#course-view')).to_be_visible()
        self.page.locator('#course-view a[href="#/lesson/powers"]').click()
        expect(self.page.locator('#lesson-view')).to_be_visible()
        for section in ('meaning', 'zero', 'negative', 'properties', 'signs', 'example'):
            self.page.locator(f'[data-section-link="{section}"]').click()
            expect(self.page.locator('#' + section + '-heading')).to_be_focused()
        self.page.set_viewport_size({'width': 390, 'height': 900})
        self.go('/lesson/powers')
        self.page.locator('.lesson-contents summary').click()
        self.page.locator('[data-section-link="negative"]').click()
        expect(self.page.locator('#negative-heading')).to_be_focused()
        self.page.locator('#back-to-top').click()
        expect(self.page.locator('.brand')).to_be_focused()
        self.assertEqual(self.page.evaluate('scrollY'), 0)

    def test_demo_login_and_logout(self):
        self.go('/account')
        self.page.locator('#login-identifier').press('Enter')
        expect(self.page.locator('#login-verification')).to_be_hidden()
        self.page.locator('#login-identifier').fill('demo-test')
        self.page.locator('#login-password').fill('demo-only')
        self.page.locator('#toggle-login-password').click()
        expect(self.page.locator('#login-password')).to_have_attribute('type', 'text')
        self.page.locator('#login-slider-handle').focus()
        self.page.keyboard.press('End')
        expect(self.page.locator('#demo-captcha')).to_be_visible()
        values = sorted(map(int, self.page.locator('.captcha-number').all_text_contents()))
        self.page.get_by_role('button', name=f'Число {values[-1]}', exact=True).click()
        expect(self.page.locator('#captcha-feedback')).to_contain_text('Порядок сбился')
        for value in values:
            self.page.get_by_role('button', name=f'Число {value}', exact=True).click()
        expect(self.page.locator('#cabinet-view')).to_be_visible()
        expect(self.page.locator('#login-password')).to_have_value('')
        self.page.reload()
        expect(self.page.locator('#account-view')).to_be_visible()
        self.page.locator('#login-identifier').fill('demo-test')
        self.page.locator('#login-password').fill('demo-only')
        self.page.locator('#login-slider-handle').focus()
        self.page.keyboard.press('End')
        for value in sorted(map(int, self.page.locator('.captcha-number').all_text_contents())):
            self.page.get_by_role('button', name=f'Число {value}', exact=True).click()
        expect(self.page.locator('#cabinet-view')).to_be_visible()
        self.page.locator('#demo-sign-out').click()
        expect(self.page.locator('#account-view')).to_be_visible()


    def test_results_score_guide(self):
        for width in (390, 1440):
            with self.subTest(width=width):
                self.page.set_viewport_size({'width': width, 'height': 900})
                self.go('/')
                guide = self.page.locator('#oge-score-guide')
                expect(guide.locator('table')).to_be_hidden()
                guide.locator('summary').focus()
                self.page.keyboard.press('Enter')
                expect(guide.locator('table')).to_be_visible()
                expect(guide.locator('.home-geometry-note')).to_contain_text('не менее 2 баллов')
                expect(guide).to_contain_text('Республики Дагестан, 2026 год')
                self.assertTrue(self.page.evaluate(
                    'document.documentElement.scrollWidth <= innerWidth'))
                self.page.keyboard.press('Enter')
                expect(guide.locator('table')).to_be_hidden()

    def assert_carousel_slide(self, index):
        carousel = self.page.locator('#home-carousel')
        expect(carousel.locator('[data-carousel-slide]:visible')).to_have_count(1)
        for number in range(3):
            slide = carousel.locator(f'[data-carousel-slide="{number}"]')
            if number == index:
                expect(slide).to_be_visible()
                expect(carousel.locator(f'[data-carousel-go="{number}"]')).to_have_attribute(
                    'aria-current', 'true')
            else:
                expect(slide).to_be_hidden()
                expect(slide).to_have_attribute('hidden', '')
                self.assertFalse(slide.evaluate('el => el.contains(document.activeElement)'),
                                 'Focus must not remain in an inactive slide')
        expect(carousel.locator('[data-carousel-go][aria-current="true"]')).to_have_count(1)

    def test_home_carousel_manual_controls_and_links(self):
        for width in (390, 1440):
            with self.subTest(width=width):
                self.page.set_viewport_size({'width': width, 'height': 900})
                self.go('/')
                carousel = self.page.locator('#home-carousel')
                # Hash-only navigation retains state; reload for a fresh viewport run.
                self.page.reload()
                self.page.evaluate('document.fonts.ready')
                controls = carousel.locator('.home-carousel-controls')
                controls_top = controls.evaluate('el => el.getBoundingClientRect().top + scrollY')

                def verify_slide(index):
                    self.assert_carousel_slide(index)
                    self.assertAlmostEqual(
                        controls.evaluate('el => el.getBoundingClientRect().top + scrollY'),
                        controls_top, delta=1, msg='Carousel controls shift between slides')

                expect(carousel).to_have_attribute('data-playing', 'false')
                verify_slide(0)
                carousel.locator('[data-carousel-next]').click()
                verify_slide(1)
                carousel.locator('[data-carousel-prev]').click()
                verify_slide(0)
                carousel.locator('[data-carousel-prev]').click()
                verify_slide(2)
                carousel.locator('[data-carousel-go="1"]').click()
                verify_slide(1)
                self.page.keyboard.press('ArrowRight')
                verify_slide(2)
                self.page.keyboard.press('ArrowLeft')
                verify_slide(1)
                self.page.keyboard.press('Home')
                verify_slide(0)
                self.page.keyboard.press('End')
                verify_slide(2)
                # Leaving a slide from its content must not strand focus in hidden DOM.
                carousel.locator('[data-carousel-go="0"]').click()
                carousel.locator('[data-carousel-slide="0"] a').focus()
                self.page.keyboard.press('End')
                verify_slide(2)
                expect(carousel.locator('[data-carousel-go="2"]')).to_be_focused()
                if width == 390:
                    carousel.locator('[data-carousel-go="0"]').click()
                    slide = carousel.locator('[data-carousel-slide="0"]')
                    slide.scroll_into_view_if_needed()
                    box = slide.bounding_box()
                    touch = self.context.new_cdp_session(self.page)
                    try:
                        for event, x in [('touchStart', box['x'] + 250),
                                         ('touchMove', box['x'] + 200),
                                         ('touchMove', box['x'] + 140)]:
                            touch.send('Input.dispatchTouchEvent', {
                                'type': event,
                                'touchPoints': [{'x': x, 'y': box['y'] + 100}]})
                        touch.send('Input.dispatchTouchEvent', {
                            'type': 'touchEnd', 'touchPoints': []})
                    finally:
                        touch.detach()
                    verify_slide(1)
                expect(carousel).to_have_attribute('data-playing', 'false')
                expect(carousel.locator('[data-carousel-toggle]')).to_have_attribute(
                    'aria-pressed', 'false')
                self.assertTrue(self.page.evaluate(
                    'document.documentElement.scrollWidth <= innerWidth'))
                self.page.locator('#carousel-lesson-scroll').click()
                expect(self.page.locator('#trial-title')).to_be_focused()
                self.page.locator('.home-trial a[href="#/lesson/powers"]').click()
                expect(self.page.locator('#lesson-view')).to_be_visible()

    def test_home_carousel_autoplay_and_pause(self):
        self.page.emulate_media(reduced_motion='no-preference')
        self.page.clock.install()
        self.go('/')
        carousel = self.page.locator('#home-carousel')
        carousel.scroll_into_view_if_needed()
        self.page.mouse.move(0, 0)
        expect(carousel).to_have_attribute('data-playing', 'true')
        expect(carousel).to_have_attribute('data-rotating', 'true')
        self.page.clock.run_for(9200)
        self.assert_carousel_slide(1)

        self.page.evaluate("scrollTo({top: 0, behavior: 'instant'})")
        expect(carousel).to_have_attribute('data-rotating', 'false')
        self.page.clock.run_for(10000)
        self.assert_carousel_slide(1)
        carousel.scroll_into_view_if_needed()
        expect(carousel).to_have_attribute('data-rotating', 'true')

        # Hover/focus suspend rotation without changing the user's play choice.
        carousel.hover()
        expect(carousel).to_have_attribute('data-rotating', 'false')
        self.page.clock.run_for(10000)
        self.assert_carousel_slide(1)
        expect(carousel).to_have_attribute('data-playing', 'true')
        self.page.mouse.move(0, 0)
        carousel.locator('[data-carousel-next]').focus()
        expect(carousel).to_have_attribute('data-rotating', 'false')
        self.page.clock.run_for(10000)
        self.assert_carousel_slide(1)

        # A deliberate selection stops autoplay until the user starts it again.
        carousel.locator('[data-carousel-next]').click()
        self.assert_carousel_slide(2)
        expect(carousel).to_have_attribute('data-playing', 'false')
        self.page.clock.run_for(10000)
        self.assert_carousel_slide(2)
        toggle = carousel.locator('[data-carousel-toggle]')
        toggle.click()
        expect(toggle).to_have_attribute('aria-pressed', 'true')
        self.page.locator('.brand').evaluate('el => el.focus({preventScroll: true})')
        carousel.scroll_into_view_if_needed()
        self.page.mouse.move(0, 0)
        expect(carousel).to_have_attribute('data-rotating', 'true')
        self.page.clock.run_for(9200)
        self.assert_carousel_slide(0)
        toggle.click()
        expect(toggle).to_have_attribute('aria-pressed', 'false')
        self.page.clock.run_for(10000)
        self.assert_carousel_slide(0)

        # A route change prevents an off-screen carousel from cycling.
        toggle.click()
        self.page.locator('.brand').evaluate('el => el.focus({preventScroll: true})')
        carousel.scroll_into_view_if_needed()
        self.page.mouse.move(0, 0)
        expect(carousel).to_have_attribute('data-rotating', 'true')
        self.page.evaluate("location.hash = '#/lesson/powers'")
        expect(self.page.locator('#lesson-view')).to_be_visible()
        expect(carousel).to_have_attribute('data-rotating', 'false')
        self.page.clock.run_for(10000)
        expect(carousel.locator('[data-carousel-slide="0"]')).not_to_have_attribute('hidden', '')

    def test_home_carousel_reduced_motion(self):
        self.page.clock.install()
        self.go('/')
        carousel = self.page.locator('#home-carousel')
        carousel.scroll_into_view_if_needed()
        self.page.mouse.move(0, 0)
        expect(carousel).to_have_attribute('data-playing', 'false')
        expect(carousel).to_have_attribute('data-rotating', 'false')
        expect(carousel.locator('[data-carousel-toggle]')).to_have_attribute(
            'aria-pressed', 'false')
        self.page.clock.run_for(20000)
        self.assert_carousel_slide(0)


if __name__ == '__main__':
    unittest.main()
