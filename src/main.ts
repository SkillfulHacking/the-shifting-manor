import { Game } from './game/game';

const root = document.getElementById('app')!;
const game = new Game(root);
game.boot().catch((e) => {
  console.error(e);
  root.insertAdjacentHTML('beforeend', `<pre style="position:absolute;left:12px;top:12px;color:#f88">${String(e?.stack ?? e)}</pre>`);
});
window.addEventListener('beforeunload', () => game.save());
