import { registerRootComponent } from 'expo';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

void LoadSkiaWeb({
  locateFile: file => `/${file}`,
}).then(async () => {
  const App = (await import('./App')).default;
  registerRootComponent(App);
}).catch(error => {
  console.error('Unable to load the match renderer', error);
  const root = document.getElementById('root');
  if (root !== null) {
    root.textContent = 'Hero Football Manager could not load. Please refresh and try again.';
  }
});
