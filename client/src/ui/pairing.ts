// 홈서버 연결(페어링) 화면 (US3). 선택 기능: 연결하지 않아도 앱은 이 기기에서 완전히 동작한다.
import type { Screen } from '../app.ts';
import type { Ctx } from '../context.ts';
import { services } from '../services.ts';
import { h } from './dom.ts';

export function pairingScreen(ctx: Ctx): Screen {
  return {
    title: '홈서버 연결',
    tab: 'settings',
    mount(container) {
      const code = h('input', { class: 'input', type: 'text', attrs: { id: 'pair-code', autocomplete: 'off', autocapitalize: 'characters', placeholder: 'XXXX-XXXX' } });
      const error = h('p', { class: 'field-error', attrs: { role: 'alert' } });
      const button = h('button', { class: 'btn btn-primary', type: 'submit', text: '등록' });

      async function submit(): Promise<void> {
        error.textContent = '';
        button.disabled = true;
        try {
          const res = await fetch('/api/pair', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-Fitness-Client': '1' },
            body: JSON.stringify({ code: code.value, deviceId: ctx.deviceId }),
          });
          if (res.status === 201) {
            await services.engine?.markPaired(); // 그동안 이 기기에 쌓인 기록을 모두 올린다
            services.realtime?.restart();
            await services.engine?.syncNow();
            location.hash = '#/settings';
            return;
          }
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          error.textContent =
            body.error === 'invalid_code'
              ? '페어링 코드가 틀렸거나 만료되었어요. 서버에서 새 코드를 만들어 주세요'
              : body.error === 'invalid_device_id'
                ? '이 기기는 이미 등록되어 있어요. 서버에서 이 기기를 해제한 뒤 다시 시도해 주세요'
                : body.error === 'rate_limited'
                  ? '시도가 너무 많아요. 잠시 뒤에 다시 해 주세요'
                  : '등록하지 못했어요';
        } catch {
          error.textContent = '홈서버에 연결하지 못했어요. 같은 네트워크(또는 VPN)에 있는지 확인해 주세요';
        } finally {
          button.disabled = false;
        }
      }

      container.append(
        h('p', { class: 'hint', text: '홈서버에서 `fitness-admin pair --name <이름>` 으로 코드를 만든 뒤 입력하세요. 연결하면 이 기기의 기록이 홈서버에 저장되고 다른 기기와 같아져요.' }),
        h(
          'form',
          { onSubmit: (ev: Event) => { ev.preventDefault(); void submit(); } },
          h('div', { class: 'field' }, h('label', { text: '페어링 코드', attrs: { for: 'pair-code' } }), code, error),
          h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', text: '취소', onClick: () => (location.hash = '#/settings') }), button),
        ),
      );
    },
  };
}
