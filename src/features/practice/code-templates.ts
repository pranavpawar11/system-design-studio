import type { ProgrammingLanguage } from '../preferences/preferences.types';

export function starterFileForLanguage(language: ProgrammingLanguage, className = 'Main') {
  const safeName = className.replace(/[^A-Za-z0-9_]/g, '') || 'Main';
  if (language === 'java') return { path: `${safeName}.java`, content: `public class ${safeName} {\n    public static void main(String[] args) {\n        // TODO: implement your solution\n    }\n}\n` };
  if (language === 'cpp') return { path: 'main.cpp', content: `#include <iostream>\n\nint main() {\n    // TODO: implement your solution\n    return 0;\n}\n` };
  return { path: 'main.py', content: `def solve():\n    # TODO: implement your solution\n    pass\n\nif __name__ == "__main__":\n    solve()\n` };
}
