import { describe, expect, it } from 'vitest';
import { MessageHistory } from '../../src/ui/messages';

describe('message history and chatbox', () => {
  it('reads the chatbox oldest first and keeps only the newest lines', () => {
    const history = new MessageHistory();
    for (const n of [1, 2, 3, 4]) history.add(`Line ${n}`, 'story');
    const chat = history.chat(3);
    expect(chat).not.toContain('Line 1');
    expect(chat.indexOf('Line 2')).toBeLessThan(chat.indexOf('Line 4'));
  });

  it('counts repeats on one chat line', () => {
    const history = new MessageHistory();
    history.add('Move closer', 'warning');
    history.add('Move closer', 'warning');
    expect(history.chat(5)).toContain('(×2)');
  });

  it('shows celebrations in the chatbox without adding them to Messages', () => {
    const history = new MessageHistory();
    history.add('The nets are ready.', 'story');
    history.add("Congratulations, you've completed a story: Into the Deep!", 'memory', true);
    expect(history.chat(5)).toContain('data-chat="celebration"');
    expect(history.view()).toContain('The nets are ready.');
    expect(history.view()).not.toContain('Congratulations');
  });

  it('escapes message text', () => {
    const history = new MessageHistory();
    history.add('<b>bold</b>', 'story');
    expect(history.chat(1)).toContain('&lt;b&gt;');
  });
});
