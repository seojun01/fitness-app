// 설정 화면: 무게 단위 (FR-012), 홈서버 연결 상태, 데이터 내보내기와 전체 삭제 (FR-014)
import type { WeightUnit } from '../../../shared/model.ts';
import type { Screen } from '../app.ts';
import type { Ctx } from '../context.ts';
import { getWeightUnit, setWeightUnit } from '../settings.ts';
import { downloadJson, eraseAllData, exportAllData } from '../export.ts';
import { services } from '../services.ts';
import { readTheme, saveTheme, type Theme } from '../theme.ts';
import { describeStatus } from '../sync/status.ts';
import { choose } from './dialog.ts';
import { h } from './dom.ts';
import { showToast } from './toast.ts';

export function settingsScreen(ctx: Ctx): Screen {
  return {
    title: '설정',
    tab: 'settings',
    async mount(container) {
      const unit = await getWeightUnit(ctx.db);
      const radio = (value: WeightUnit) =>
        h(
          'label',
          { class: 'list-item' },
          h('input', {
            type: 'radio',
            name: 'weight-unit',
            value,
            checked: unit === value,
            onChange: () => void setWeightUnit(ctx, value),
          }),
          h('span', { class: 'list-item-title', text: value }),
        );
      const theme = readTheme();
      const themeRadio = (value: Theme, label: string) =>
        h('label', { class: 'list-item' }, h('input', { type: 'radio', name: 'theme', value, checked: theme === value, onChange: () => saveTheme(value) }), h('span', { class: 'list-item-title', text: label }));
      container.appendChild(
        h(
          'section',
          { class: 'card' },
          h('fieldset', { attrs: { style: 'border:0;padding:0;margin:0' } }, h('legend', { class: 'field-label', text: '화면 테마' }), themeRadio('dark', '어둡게'), themeRadio('light', '밝게'), themeRadio('system', '시스템 설정 따르기')),
          h('p', { class: 'hint', text: '이 기기에만 적용돼요.' }),
        ),
      );
      const st = await services.engine?.status();
      const view = st ? describeStatus(st) : null;
      container.appendChild(
        h(
          'section',
          { class: 'card' },
          h('p', { class: 'field-label', text: '홈서버 연결' }),
          h('p', { class: 'hint', text: view?.text ?? '' }),
          st?.paired && st.state !== 'unauthorized' ? null : h('a', { class: 'btn', attrs: { href: '#/pair' }, text: st?.paired ? '다시 등록하기' : '홈서버에 연결' }),
        ),
      );
      container.append(
        h(
          'section',
          { class: 'card' },
          h('fieldset', { attrs: { style: 'border:0;padding:0;margin:0' } }, h('legend', { class: 'field-label', text: '무게 단위' }), radio('kg'), radio('lb')),
          h('p', { class: 'hint', text: '기록은 kg 로 저장하고, 단위를 바꿔도 표시만 달라져요.' }),
        ),
        h(
          'section',
          { class: 'card' },
          h('p', { class: 'field-label', text: '내 데이터' }),
          h('p', { class: 'hint', text: '운동 기록은 내 것이에요. 언제든 파일로 받거나 모두 지울 수 있어요.' }),
          h(
            'div',
            { class: 'btn-row' },
            h('button', {
              class: 'btn',
              type: 'button',
              text: '데이터 내보내기',
              onClick: async () => {
                const data = await exportAllData(ctx.db);
                downloadJson(data, `fitness-export-${data.exportedAt.slice(0, 10)}.json`);
                showToast('내보내기 파일을 만들었어요');
              },
            }),
            h('button', {
              class: 'btn btn-danger',
              type: 'button',
              text: '모든 데이터 삭제',
              onClick: async () => {
                const paired = (await services.engine?.status())?.paired === true;
                const choice = await choose(
                  '모든 데이터를 삭제할까요?',
                  paired ? '루틴, 운동 기록, 직접 만든 종목, 설정이 이 기기와 홈서버, 연결된 모든 기기에서 지워져요. 되돌릴 수 없어요.' : '루틴, 운동 기록, 직접 만든 종목, 설정이 이 기기에서 지워져요. 되돌릴 수 없어요.',
                  [
                    { value: 'cancel', label: '취소' },
                    { value: 'erase', label: '모두 삭제', danger: true },
                  ],
                );
                if (choice !== 'erase') return;
                await eraseAllData(ctx);
                showToast('모든 데이터를 삭제했어요');
                location.hash = '#/routines';
              },
            }),
          ),
        ),
      );
    },
  };
}
