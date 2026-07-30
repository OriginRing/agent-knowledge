---
name: chart-visualization
description: 将用户提供的数据转换为前端可直接渲染的 GPT-Vis 图表，并附上简短的数据解读。
kind: prompt
intent_keywords: 生成图表,绘制图表,画图表,数据可视化,可视化展示,折线图,柱状图,条形图,饼图,面积图,散点图,雷达图,可视化表格
---

你正在执行“GPT-Vis 图表生成”技能。

根据用户的数据和表达目的，从以下图表类型中选择最合适的一种或多种：

- `line`：展示时间序列或连续趋势，字段为 `time`、`value`，可选 `group`。
- `area`：展示随时间变化的总量、累计量或构成趋势，字段为 `time`、`value`，可选 `group`。
- `column`：纵向比较不同类别，字段为 `category`、`value`，可选 `group`。
- `bar`：横向比较类别，适合类别名称较长或类别较多的数据，字段为 `category`、`value`，可选 `group`。
- `pie`：展示少量类别的占比或部分与整体关系，字段为 `category`、`value`。
- `scatter`：展示两个数值变量之间的关系，字段为 `x`、`y`，可选 `group`。
- `radar`：比较多个指标或多个对象的能力维度，字段为 `name`、`value`，可选 `group`。
- `table`：用户明确要求可视化表格，或数据不适合上述图表时使用；保留每条记录的原始字段。

最终回答必须使用以下结构：

1. 先给出简短的图表标题或说明。
2. 使用独立的 Markdown 围栏代码块输出每个图表。代码块语言标识必须是 `vis <type>`，代码块内容必须以 `data` 开始。
3. 图表后给出一至三条简短、可由数据直接支持的洞察。

示例：

```vis line
data
  - time 2024-01
    value 120
  - time 2024-02
    value 156
title "月度销售额"
axisXTitle "月份"
axisYTitle "销售额"
```

严格遵守以下约束：

- 只输出 `line`、`area`、`column`、`bar`、`pie`、`scatter`、`radar` 或 `table`。
- 一个回答可以包含多个图表，但每个图表必须使用独立的 `vis <type>` 代码块。
- 保持用户给出的数值为数字，不要给数字添加引号、单位或千位分隔符；把单位写入标题或坐标轴标题。
- 包含空格的文本值必须使用双引号包裹。
- 多系列数据必须为每条数据填写 `group`，并保持同一系列名称一致。
- 不要虚构、补齐或修改用户没有提供的数据。数据不足以生成图表时，明确说明缺少什么并请求用户补充，不要输出空图表。
- 不要把 GPT-Vis 数据输出为 JSON、JavaScript、普通 Markdown 表格、图片链接或除 `vis <type>` 以外的代码块。
