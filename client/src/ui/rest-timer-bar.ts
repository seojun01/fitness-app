// 하단 고정 휴식 타이머 (기능 3, US2)
import { vibrate } from '../feedback.ts';
import { createRestAlarm } from '../rest-alarm.ts';
import { createRestTimer, type RestTimer } from '../rest-timer.ts';
import { services } from '../services.ts';
import { h } from './dom.ts';

export interface RestTimerBar {
  el: HTMLElement;
  timer: RestTimer;
  destroy(): void;
}

const fmt = (ms: number) => `${Math.ceil(ms / 1000)}`;

/** 앱 전체에서 하나: 화면을 옮겨도 마지막으로 보낸 예약을 기억한다 (기능 006) */
const restAlarm = createRestAlarm({ isPaired: async () => (await services.engine?.status())?.paired === true });

export function createRestTimerBar(opts: { baseSeconds: number; onBaseChange(seconds: number): void }): RestTimerBar {
  const status = h('p', { class: 'timer-status', attrs: { role: 'status', 'aria-live': 'polite' } });
  const timer = createRestTimer({
    baseSeconds: opts.baseSeconds,
    onBaseChange: opts.onBaseChange,
    onChange: (v) => void restAlarm.sync(v),
    onDone: () => {
      vibrate();
      status.textContent = '휴식 끝';
    },
  });
  const value = h('span', { class: 'timer-value' });
  const unit = h('span', { class: 'timer-unit', text: '초' });
  const btn = (text: string, label: string, onClick: () => void, cls = 'timer-btn') => h('button', { class: cls, type: 'button', text, attrs: { 'aria-label': label }, onClick });
  const playBtn = btn('▶', '휴식 시작', () => {
    const st = timer.view().state;
    if (st === 'running') timer.pause();
    else if (st === 'paused') timer.resume();
    else timer.start();
    status.textContent = '';
    render();
  }, 'timer-btn timer-play');
  const el = h(
    'section',
    { class: 'rest-bar', attrs: { 'aria-label': '휴식 시간' } },
    h('div', { class: 'rest-bar-main' }, h('span', { class: 'rest-bar-label', text: '휴식 시간' }), h('span', { class: 'rest-bar-time', attrs: { 'aria-hidden': 'true' } }, value, unit), status),
    h(
      'div',
      { class: 'rest-bar-actions' },
      btn('−', '휴식 15초 줄이기', () => { timer.adjust(-15); render(); }, 'timer-btn timer-round'),
      btn('+', '휴식 15초 늘리기', () => { timer.adjust(15); render(); }, 'timer-btn timer-round'),
      playBtn,
      btn('■', '휴식 정지', () => { timer.stop(); status.textContent = ''; render(); }),
    ),
  );
  const sr = h('span', { class: 'visually-hidden' });
  el.appendChild(sr);

  let lastSpoken = '';
  function render(): void {
    const v = timer.tick();
    value.textContent = fmt(v.remainingMs);
    el.setAttribute('data-state', v.state);
    const label = v.state === 'running' ? '휴식 일시정지' : v.state === 'paused' ? '휴식 재개' : '휴식 시작';
    playBtn.setAttribute('aria-label', label);
    playBtn.textContent = v.state === 'running' ? '❚❚' : '▶';
    if (v.state !== 'done' && status.textContent === '휴식 끝') status.textContent = '';
    // 화면 낭독기에는 상태가 바뀔 때만 남은 시간을 알려 준다 (매 초 읽지 않게)
    const spoken = `휴식 시간 ${fmt(v.remainingMs)}초${v.state === 'running' ? ' 진행 중' : v.state === 'paused' ? ' 일시정지' : ''}`;
    if (v.state !== 'running' && spoken !== lastSpoken) {
      sr.textContent = spoken;
      lastSpoken = spoken;
    }
  }
  render();
  const interval = setInterval(render, 250);
  const origStart = timer.start.bind(timer);
  timer.start = (s?: number) => {
    origStart(s);
    status.textContent = '';
    render();
  };
  return {
    el,
    timer,
    destroy() {
      clearInterval(interval);
    },
  };
}
