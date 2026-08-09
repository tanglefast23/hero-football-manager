import deJson from '../../content/i18n/de.json';
import esJson from '../../content/i18n/es.json';
import frJson from '../../content/i18n/fr.json';
import idJson from '../../content/i18n/id.json';
import ptBrJson from '../../content/i18n/pt-BR.json';
import viJson from '../../content/i18n/vi.json';
import { registerCatalog } from './load-catalogs';

// Jest tests use copyFor synchronously. Register every catalog in this
// test-only entry point without putting them back in the production graph.
registerCatalog('es', esJson);
registerCatalog('pt-BR', ptBrJson);
registerCatalog('fr', frJson);
registerCatalog('de', deJson);
registerCatalog('id', idJson);
registerCatalog('vi', viJson);
