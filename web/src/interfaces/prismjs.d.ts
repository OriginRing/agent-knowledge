declare module "prismjs" {
  interface PrismStatic {
    languages: Record<string, unknown>;
    highlightElement: (element: Element) => void;
  }

  const Prism: PrismStatic;
  export default Prism;
}
