
const views = [...document.querySelectorAll('.site-view')];
const baseTitle = 'Tavaspar Education';
const courses = {
  oge: {
    title: 'Подготовка к ОГЭ',
    shortTitle: 'ОГЭ',
    level: 'Математика · 9 класс',
    description: 'Школьная база, алгебра и геометрия. Последовательно разбираем темы и учимся применять правила в экзаменационных задачах.',
    topics: ['Вычисления', 'Алгебра', 'Геометрия'],
  },
  base: {
    title: 'ЕГЭ. Базовый уровень',
    shortTitle: 'ЕГЭ база',
    level: 'Математика · 11 класс',
    description: 'Основные математические навыки: вычисления, проценты, уравнения и геометрия. Разбираем понятные способы решения по каждой теме.',
    topics: ['Проценты и дроби', 'Уравнения', 'Геометрия'],
  },
  profile: {
    title: 'ЕГЭ. Профильный уровень',
    shortTitle: 'ЕГЭ профиль',
    level: 'Математика · 11 класс',
    description: 'От базовых преобразований к сложным задачам. Разбираем алгебру, геометрию и вероятность, уделяем внимание обоснованиям и оформлению решений.',
    topics: ['Алгебра', 'Геометрия', 'Вероятность'],
  },
};
const sectionNames = new Set(['meaning', 'zero', 'negative', 'properties', 'signs', 'example']);

// This is a local interaction preview, not an authentication or anti-bot system.
// Credentials remain only in the inputs and are cleared when leaving or signing in.
const loginForm = document.querySelector('#demo-login-form');
const loginIdentifier = document.querySelector('#login-identifier');
const loginPassword = document.querySelector('#login-password');
const passwordToggle = document.querySelector('#toggle-login-password');
const verificationDrawer = document.querySelector('#login-verification');
const sliderTrack = document.querySelector('#login-slider-track');
const sliderHandle = document.querySelector('#login-slider-handle');
const captchaDialog = document.querySelector('#demo-captcha');
const captchaFeedback = document.querySelector('#captcha-feedback');
let demoSignedIn = false;
let sliderValue = 0;
let sliderDrag = null;
let verificationPhase = 'idle';
let captchaOpeningTimer = null;
let captchaOrder = [];
let captchaProgress = 0;

function scrollToElement(element, smooth = false) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({ block: 'start', behavior: smooth && !reduceMotion ? 'smooth' : 'instant' });
  element.focus({ preventScroll: true });
}

function renderRoute() {
  const fragment = window.location.hash.slice(1) || '/';
  const [rawPath, query = ''] = fragment.split('?');
  const path = rawPath === 'trial-lesson' ? '/lesson/powers' : rawPath;
  if (path === 'main') {
    document.querySelector('#main').focus();
    return;
  }
  if (path !== '/account') resetDemoLogin();
  let viewId = 'not-found-view';
  let title = 'Страница не найдена';
  let nav = '';
  let focusTarget;

  if (path === '/' || path === '/directions') {
    viewId = 'home-view';
    title = 'Подготовка к ОГЭ и ЕГЭ по математике';
    if (path === '/directions') {
      nav = 'directions';
      focusTarget = document.querySelector('#courses-title');
    }
  } else if (path.startsWith('/course/')) {
    const key = path.slice('/course/'.length);
    const course = Object.hasOwn(courses, key) ? courses[key] : null;
    if (course) {
      viewId = 'course-view';
      nav = 'directions';
      title = course.title;
      document.querySelector('#course-title').textContent = course.title;
      document.querySelector('#course-breadcrumb').textContent = course.shortTitle;
      document.querySelector('#course-level').textContent = course.level;
      document.querySelector('#course-description').textContent = course.description;
      document.querySelector('#course-topics').replaceChildren(...course.topics.map(topic => {
        const chip = document.createElement('span');
        chip.textContent = topic;
        return chip;
      }));
    }
  } else if (path === '/lesson/powers') {
    viewId = 'lesson-view';
    title = 'Степени с целым показателем';
    const requested = new URLSearchParams(query).get('section');
    const section = sectionNames.has(requested) ? requested : 'meaning';
    document.querySelectorAll('[data-section-link]').forEach(link => {
      if (link.dataset.sectionLink === section) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    document.querySelector('.lesson-contents').open = window.matchMedia('(min-width: 901px)').matches;
    if (sectionNames.has(requested)) focusTarget = document.getElementById(`${section}-heading`);
  } else if (path === '/about') {
    viewId = 'about-view';
    title = 'О преподавателе';
    nav = 'about';
  } else if (path === '/account') {
    viewId = demoSignedIn ? 'cabinet-view' : 'account-view';
    title = 'Личный кабинет';
    nav = 'account';
  }

  views.forEach(view => { view.hidden = view.id !== viewId; });
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === nav) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = `${title} — ${baseTitle}`;
  const activeView = document.getElementById(viewId);
  requestAnimationFrame(() => {
    if (focusTarget) scrollToElement(focusTarget);
    else {
      window.scrollTo({ top: 0, behavior: 'instant' });
      activeView.querySelector('h1')?.focus({ preventScroll: true });
    }
  });
}

window.addEventListener('hashchange', renderRoute);
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#/"]');
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  if (link.hash === window.location.hash) {
    event.preventDefault();
    renderRoute();
  }
});
document.querySelector('#back-to-top').addEventListener('click', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
  document.querySelector('.brand').focus({ preventScroll: true });
});

function loginFieldsFilled() {
  return loginIdentifier.value.trim().length > 0 && loginPassword.value.length > 0;
}

function sliderTravel() {
  return Math.max(0, sliderTrack.clientWidth - sliderHandle.offsetWidth - 8);
}

function paintSlider(value) {
  sliderValue = Math.max(0, Math.min(100, value));
  const x = sliderTravel() * sliderValue / 100;
  sliderTrack.style.setProperty('--slider-x', `${x}px`);
  sliderTrack.style.setProperty('--slider-fill', `${x + sliderHandle.offsetWidth + 4}px`);
  sliderTrack.style.setProperty('--slider-label-opacity', String(Math.max(0, 1 - sliderValue / 65)));
  sliderHandle.setAttribute('aria-valuenow', String(Math.round(sliderValue)));
  sliderHandle.setAttribute('aria-valuetext', sliderValue === 0 ? 'Ползунок в начале' : `${Math.round(sliderValue)} процентов`);
}

function releaseSliderPointer() {
  if (!sliderDrag) return;
  const pointerId = sliderDrag.pointerId;
  sliderDrag = null;
  if (sliderHandle.hasPointerCapture(pointerId)) sliderHandle.releasePointerCapture(pointerId);
}

function resetVerification() {
  window.clearTimeout(captchaOpeningTimer);
  captchaOpeningTimer = null;
  releaseSliderPointer();
  verificationPhase = 'idle';
  sliderTrack.dataset.state = 'idle';
  document.querySelector('#login-slider-label').textContent = 'Перетащи вправо';
  sliderHandle.setAttribute('aria-disabled', 'false');
  paintSlider(0);
}

function resetDemoLogin() {
  if (captchaDialog.open) captchaDialog.close('cancel');
  loginForm.reset();
  loginPassword.type = 'password';
  passwordToggle.setAttribute('aria-pressed', 'false');
  passwordToggle.setAttribute('aria-label', 'Показать пароль');
  document.querySelector('#password-slash').setAttribute('hidden', '');
  verificationDrawer.hidden = true;
  document.querySelector('#login-form-message').textContent = '';
  resetVerification();
}

function updateVerificationDrawer() {
  if (captchaDialog.open) captchaDialog.close('changed');
  verificationDrawer.hidden = !loginFieldsFilled();
  document.querySelector('#login-form-message').textContent = '';
  resetVerification();
}

[loginIdentifier, loginPassword].forEach(input => {
  input.addEventListener('input', updateVerificationDrawer);
  input.addEventListener('change', updateVerificationDrawer);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      loginForm.requestSubmit();
    }
  });
});

loginForm.addEventListener('submit', event => {
  event.preventDefault();
  updateVerificationDrawer();
  if (loginFieldsFilled()) sliderHandle.focus();
  else {
    document.querySelector('#login-form-message').textContent = 'Введи любой текст в оба поля.';
    (loginIdentifier.value.trim() ? loginPassword : loginIdentifier).focus();
  }
});

passwordToggle.addEventListener('click', () => {
  const show = loginPassword.type === 'password';
  loginPassword.type = show ? 'text' : 'password';
  passwordToggle.setAttribute('aria-pressed', String(show));
  passwordToggle.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
  document.querySelector('#password-slash').toggleAttribute('hidden', !show);
});

sliderHandle.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !event.isPrimary || verificationPhase !== 'idle' || !loginFieldsFilled()) return;
  event.preventDefault();
  sliderHandle.focus({ preventScroll: true });
  sliderDrag = { pointerId: event.pointerId, startX: event.clientX, startValue: sliderValue, travel: sliderTravel() };
  sliderTrack.dataset.state = 'dragging';
  sliderHandle.setPointerCapture(event.pointerId);
});

sliderHandle.addEventListener('pointermove', event => {
  if (!sliderDrag || event.pointerId !== sliderDrag.pointerId) return;
  const travel = sliderTravel();
  if (travel > 0) paintSlider(sliderDrag.startValue + (event.clientX - sliderDrag.startX) / travel * 100);
});

sliderHandle.addEventListener('pointerup', event => {
  if (!sliderDrag || event.pointerId !== sliderDrag.pointerId) return;
  const completed = sliderValue >= 98;
  releaseSliderPointer();
  if (completed && event.pointerType === 'touch') finishTouchSlider();
  else if (completed) openDemoCaptcha();
  else resetVerification();
});

sliderHandle.addEventListener('pointercancel', resetVerification);
sliderHandle.addEventListener('lostpointercapture', () => {
  if (sliderDrag) resetVerification();
});

sliderHandle.addEventListener('keydown', event => {
  if (verificationPhase !== 'idle' || !loginFieldsFilled()) return;
  const changes = { ArrowRight: 10, ArrowUp: 10, ArrowLeft: -10, ArrowDown: -10, PageUp: 25, PageDown: -25 };
  let next;
  if (Object.hasOwn(changes, event.key)) next = sliderValue + changes[event.key];
  else if (event.key === 'End') next = 100;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); return; }
  if (next === undefined) return;
  event.preventDefault();
  paintSlider(next);
  if (sliderValue === 100) openDemoCaptcha();
});

window.addEventListener('resize', () => {
  if (sliderDrag && Math.abs(sliderTravel() - sliderDrag.travel) > 1) resetVerification();
  else paintSlider(sliderValue);
});

function shuffled(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function finishTouchSlider() {
  // Let the touch gesture settle before presenting new tap targets. Mobile
  // browsers can suppress a tap immediately following a drag gesture.
  verificationPhase = 'settling';
  sliderTrack.dataset.state = 'settling';
  paintSlider(100);
  document.querySelector('#login-slider-label').textContent = 'Открываем капчу…';
  sliderTrack.style.setProperty('--slider-label-opacity', '1');
  sliderHandle.setAttribute('aria-disabled', 'true');
  sliderHandle.setAttribute('aria-valuetext', 'Ползунок завершён. Открывается капча.');
  captchaOpeningTimer = window.setTimeout(() => {
    captchaOpeningTimer = null;
    if (verificationPhase !== 'settling') return;
    verificationPhase = 'idle';
    openDemoCaptcha();
  }, 1100);
}

function createNumberChallenge() {
  let values = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4);
  captchaOrder = [...values].sort((a, b) => a - b);
  if (values.every((value, index) => value === captchaOrder[index])) values.reverse();
  captchaProgress = 0;
  captchaFeedback.textContent = 'Выбрано 0 из 4';
  captchaFeedback.dataset.state = 'normal';
  document.querySelector('#captcha-numbers').replaceChildren(...values.map(value => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'captcha-number';
    button.textContent = String(value);
    button.setAttribute('aria-label', `Число ${value}`);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => chooseCaptchaNumber(value, button));
    return button;
  }));
}

function openDemoCaptcha() {
  if (!loginFieldsFilled() || verificationPhase !== 'idle' || captchaDialog.open) return;
  verificationPhase = 'challenge';
  sliderTrack.dataset.state = 'challenge';
  paintSlider(100);
  createNumberChallenge();
  captchaDialog.returnValue = '';
  captchaDialog.showModal();
  document.body.classList.add('dialog-open');
  document.querySelector('#captcha-title').focus();
}

function chooseCaptchaNumber(value, button) {
  if (!captchaDialog.open || verificationPhase !== 'challenge' || button.disabled) return;
  if (value !== captchaOrder[captchaProgress]) {
    captchaProgress = 0;
    document.querySelectorAll('.captcha-number').forEach(item => {
      item.disabled = false;
      item.setAttribute('aria-pressed', 'false');
    });
    captchaFeedback.textContent = 'Порядок сбился. Начни снова с самого маленького числа.';
    captchaFeedback.dataset.state = 'error';
    return;
  }
  button.disabled = true;
  button.setAttribute('aria-pressed', 'true');
  captchaProgress += 1;
  captchaFeedback.dataset.state = 'normal';
  captchaFeedback.textContent = `Выбрано ${captchaProgress} из 4`;
  if (captchaProgress === captchaOrder.length) {
    demoSignedIn = true;
    captchaDialog.close('passed');
    resetDemoLogin();
    renderRoute();
  }
}

document.querySelector('#close-captcha').addEventListener('click', () => captchaDialog.close('cancel'));
document.querySelector('#refresh-captcha').addEventListener('click', () => {
  createNumberChallenge();
  document.querySelector('#captcha-title').focus();
});
captchaDialog.addEventListener('close', () => {
  document.body.classList.remove('dialog-open');
  resetVerification();
  if (captchaDialog.returnValue !== 'passed' && !verificationDrawer.hidden && window.location.hash === '#/account') {
    sliderHandle.focus({ preventScroll: true });
  }
});
captchaDialog.addEventListener('click', event => {
  if (event.target !== captchaDialog) return;
  const box = captchaDialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) captchaDialog.close('cancel');
});
document.querySelector('#demo-sign-out').addEventListener('click', () => {
  demoSignedIn = false;
  resetDemoLogin();
  renderRoute();
});
renderRoute();

