import { openClubAlertCount, type ClubAlertViewModel } from '../models';

const alert = (
  id: string,
  openCountKey?: string,
  readOnly = false,
): ClubAlertViewModel => ({
  id,
  ...(openCountKey === undefined ? {} : { openCountKey }),
  title: id,
  detail: id,
  tone: 'urgent',
  ...(readOnly ? { readOnly: true } : {}),
});

test('counts one active request once across its guide and reminder cards', () => {
  expect(
    openClubAlertCount([
      alert('player-request-waiting', 'player-request:gold-boots:player-1'),
      alert(
        'assistant-guide:player-requests',
        'player-request:gold-boots:player-1',
      ),
      alert('academy-news', undefined, true),
    ]),
  ).toBe(1);
});
