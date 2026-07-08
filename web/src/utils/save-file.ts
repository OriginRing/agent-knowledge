import { asBlob } from 'html-docx-js-typescript'
import { saveAs } from 'file-saver'

export async function saveDocx(elementId: string, fileName = Date.now().toString()) {
  const element = document.getElementById(elementId)
  if (!element) return

  // ✅ A4 内容区 标准安全宽度（固定这个值）
  const A4_MAX_WIDTH = 620

  element.querySelectorAll('img').forEach((img) => {
    // 强制图片最大宽度 = A4 宽度，并且等比缩放
    img.style.maxWidth = `${A4_MAX_WIDTH}px`
    img.style.width = '100%'
    img.style.height = 'auto'

    // 同时兼容旧版渲染
    img.setAttribute('width', A4_MAX_WIDTH.toString())
    img.removeAttribute('height')
  })

  const customCss = `
        body { font-family: '微软雅黑', sans-serif; font-size: 14px; color: #333; }
        h1 { color: #1a73e8; font-size: 24px; margin-bottom: 10px; text-align: center; }
        p { line-height: 1.6; text-indent: 2em; }
        img {
          display: block !important;  
          max-width: 620px !important;
          width: 100% !important;
          height: auto !important;
          margin: 0 auto !important;
          padding: 0 !important;
          vertical-align: middle !important;
        }
    `

  const fullHtml = `
        <!DOCTYPE html>
        <html>
            <head><meta charset="UTF-8"><style>${customCss}</style></head>
            <body>${element.innerHTML}</body>
        </html>`

  const options = {
    orientation: 'portrait',
    margins: {
      top: 1440,
      right: 1440,
      bottom: 1440,
      left: 1440,
    },
    font: {
      name: '微软雅黑',
      size: 28,
    },
  }

  try {
    // @ts-ignore
    const blob: Blob = (await asBlob(fullHtml, options)) as unknown as Blob
    saveAs(blob, fileName)
  } catch (err) {
    console.error('导出Word失败:', err)
  }
}
