import Prism from "prismjs";

type GlobalWithPrism = typeof globalThis & {
  Prism?: typeof Prism;
};

// Prism 的语言组件以传统脚本形式发布，会直接读取全局 Prism。
// 显式注册可避免生产环境动态分包先执行语言组件时出现 ReferenceError。
(globalThis as GlobalWithPrism).Prism = Prism;

export { Prism };
