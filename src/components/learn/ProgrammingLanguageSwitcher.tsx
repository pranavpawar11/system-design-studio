import { Code2 } from 'lucide-react';
import {
  PROGRAMMING_LANGUAGES,
  type ProgrammingLanguage,
} from '../../features/learning/programming-language';

type Props = {
  value: ProgrammingLanguage;
  onChange: (language: ProgrammingLanguage) => void;
};

export default function ProgrammingLanguageSwitcher({ value, onChange }: Props) {
  return (
    <label className="learn-language-switcher">
      <span className="learn-language-label"><Code2 size={14} aria-hidden /> Code language</span>
      <select
        aria-label="Preferred code language"
        value={value}
        onChange={(event) => onChange(event.target.value as ProgrammingLanguage)}
      >
        {PROGRAMMING_LANGUAGES.map((language) => (
          <option key={language.id} value={language.id}>{language.label}</option>
        ))}
      </select>
    </label>
  );
}
