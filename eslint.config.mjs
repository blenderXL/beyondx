import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    rules: {
      // The "// label" prefix is intentional design vocabulary (terminal-style)
      // across landing + app surfaces. Not forgotten JS comments.
      "react/jsx-no-comment-textnodes": "off",
    },
  },
];
