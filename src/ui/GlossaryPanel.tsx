import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import type { GlossaryCatalog } from '../content';
import { ActionButton } from './components/Scorecard';
import { PixelText } from './components/PixelText';
import { useCopy } from '../i18n';

export interface GlossaryPanelProps {
  content: GlossaryCatalog;
  onBack: () => void;
  backLabel?: string;
}

export function GlossaryPanel({
  content,
  onBack,
  backLabel = 'Back to settings',
}: GlossaryPanelProps) {
  const t = useCopy();
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const categories = useMemo(() => content.categories.flatMap(category => {
    const entries = normalizedQuery.length === 0
      ? category.entries
      : category.entries.filter(entry => (
          entry.term.toLocaleLowerCase().includes(normalizedQuery)
          || entry.definition.toLocaleLowerCase().includes(normalizedQuery)
        ));
    return entries.length === 0 ? [] : [{ ...category, entries }];
  }), [content.categories, normalizedQuery]);

  return (
    <View className="min-h-0 flex-1">
      <View className="border-b-2 border-ink pb-4">
        <PixelText className="text-sm uppercase tracking-[3px] text-blue-dark">{t('glossary.clubHandbook')}</PixelText>
        <Text className="mt-1 font-pixel text-2xl uppercase text-ink">Glossary</Text>
        <Text className="mt-2 text-sm leading-5 text-ink/60">
          {t('glossary.plain-languageDefinitionsForFootball')}</Text>
        <TextInput
          accessibilityLabel={t('glossary.a11y.searchGlossary')}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={setQuery}
          placeholder="Search a term or mechanic"
          placeholderTextColor="#8f8b96"
          value={query}
          className="mt-4 min-h-12 border-2 border-ink bg-white px-3 py-2 text-base text-ink"
        />
      </View>

      <ScrollView
        className="min-h-0 flex-1"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {categories.length === 0 ? (
          <View className="border-2 border-ink/25 bg-paper-dark px-3 py-4">
            <Text className="text-center text-sm font-bold text-ink/60">No glossary terms match “{query.trim()}”.</Text>
          </View>
        ) : categories.map(category => (
          <View key={category.id} className="mb-6">
            <Text className="mb-2 font-pixel text-base uppercase text-blue-dark">{category.title}</Text>
            <View className="border-2 border-ink bg-white">
              {category.entries.map((entry, index) => (
                <View
                  key={entry.term}
                  className={index === category.entries.length - 1
                    ? 'px-3 py-3'
                    : 'border-b border-ink/15 px-3 py-3'}
                >
                  <Text className="text-base font-bold text-ink">{entry.term}</Text>
                  <Text className="mt-1 text-sm leading-5 text-ink/65">{entry.definition}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View className="border-t border-ink/15 pt-3">
        <ActionButton
          label={`‹  ${backLabel}`}
          accessibilityLabel={backLabel}
          onPress={onBack}
          variant="paper"
        />
      </View>
    </View>
  );
}
