const { chromium } = require('playwright')
const fs = require('fs')
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage()
  await p.setContent(`<html><body>${fs.readFileSync(process.argv[2], 'utf8')}</body></html>`)
  const data = await p.evaluate(() => {
    const svg = document.querySelector('svg')
    const out = []
    for (const el of svg.querySelectorAll('rect,path,polygon,ellipse,image,text,polyline,line')) {
      if (el.closest('defs,clipPath')) continue
      const bb = el.getBBox(); const m = el.getCTM(); const sm = svg.getCTM()
      const inv = sm.inverse().multiply(m)
      const pt = (x, y) => { const q = new DOMPoint(x, y).matrixTransform(inv); return [q.x, q.y] }
      const [x1, y1] = pt(bb.x, bb.y), [x2, y2] = pt(bb.x + bb.width, bb.y + bb.height)
      const cs = getComputedStyle(el)
      const ids = []; for (let n = el; n && n !== svg; n = n.parentElement) if (n.id) ids.push(n.id)
      out.push({ i: out.length, tag: el.tagName, cls: el.getAttribute('class'), fill: cs.fill, stroke: cs.stroke, ids: ids.join('<'), bb: [x1, y1, x2, y2].map((v) => +v.toFixed(1)), len: (el.getAttribute('d') || el.getAttribute('points') || '').length, tr: !!el.closest('[transform]') })
    }
    return out
  })
  fs.writeFileSync(process.argv[3], JSON.stringify(data))
  await b.close()
})()
