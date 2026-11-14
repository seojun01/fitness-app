// 화면 등록. 스토리를 구현할 때마다 여기에 화면을 더한다.
import { route } from './app.ts';
import { exerciseHistoryScreen } from './ui/exercise-history.ts';
import { guideListScreen } from './ui/guide-list.ts';
import { guideNoteEditorScreen } from './ui/guide-note-editor.ts';
import { guideScreen } from './ui/guide-screen.ts';
import { historyListScreen } from './ui/history-list.ts';
import { pairingScreen } from './ui/pairing.ts';
import { routineDetailScreen } from './ui/routine-detail.ts';
import { routineEditorScreen } from './ui/routine-editor.ts';
import { routineListScreen } from './ui/routine-list.ts';
import { sessionDetailScreen } from './ui/session-detail.ts';
import { sessionScreen } from './ui/session-screen.ts';
import { sessionSummaryScreen } from './ui/session-summary.ts';
import { settingsScreen } from './ui/settings.ts';
import { exerciseChartScreen } from './ui/exercise-chart.ts';
import { statsDayScreen } from './ui/stats-day.ts';
import { statsScreen } from './ui/stats-screen.ts';

route('/routines', (ctx) => routineListScreen(ctx));
route('/routines/new', (ctx) => routineEditorScreen(ctx, null));
route('/routines/:id', (ctx, p) => routineDetailScreen(ctx, p.id!));
route('/routines/:id/edit', (ctx, p) => routineEditorScreen(ctx, p.id!));
route('/history', (ctx) => historyListScreen(ctx));
route('/history/:id', (ctx, p) => sessionDetailScreen(ctx, p.id!));
route('/exercise/:id', (ctx, p) => exerciseHistoryScreen(ctx, p.id!));
// 같은 처리기를 써야 종목만 바뀔 때 화면을 다시 만들지 않는다 (Screen.onRoute)
const sessionRoute = (ctx: Parameters<Parameters<typeof route>[1]>[0], p: Record<string, string>) => sessionScreen(ctx, p);
route('/session', sessionRoute);
route('/session/:index', sessionRoute);
route('/session/summary/:id', (ctx, p) => sessionSummaryScreen(ctx, p.id!));
route('/stats', (ctx) => statsScreen(ctx));
route('/stats/exercise/:id', (ctx, p) => exerciseChartScreen(ctx, p.id!));
route('/stats/day/:day', (ctx, p) => statsDayScreen(ctx, p.day!));
route('/guides', (ctx) => guideListScreen(ctx));
route('/guides/:id', (ctx, p) => guideScreen(ctx, p.id!));
route('/guides/:id/edit', (ctx, p) => guideNoteEditorScreen(ctx, p.id!));
route('/settings', (ctx) => settingsScreen(ctx));
route('/pair', (ctx) => pairingScreen(ctx));
