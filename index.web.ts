import { registerRootComponent } from 'expo';
import App from './App';

// expo-audio's web player calls HTMLMediaElement.play() without a catch
// (AudioPlayer.web.js), so a browser interrupting playback — backgrounded tab,
// pause racing a load — surfaces as an uncaught AbortError rejection we cannot
// reach from any call site. Swallow exactly that; everything else still throws.
window.addEventListener('unhandledrejection', (event) => {
  const reason: unknown = event.reason;
  if (
    reason instanceof DOMException &&
    reason.name === 'AbortError' &&
    reason.message.includes('play()')
  ) {
    event.preventDefault();
  }
});

registerRootComponent(App);
