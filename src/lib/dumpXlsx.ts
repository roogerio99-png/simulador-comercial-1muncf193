// @ts-nocheck
declare const require: any

import * as XLSX from 'xlsx'
const fs = typeof require !== 'undefined' ? require('fs') : null
const path = typeof require !== 'undefined' ? require('path') : null
const proc =
  typeof globalThis !== 'undefined' && (globalThis as any).process
    ? (globalThis as any).process
    : null

if (fs && path && proc) {
  const filePath = path.resolve(proc.cwd(), 'src/assets/simuladordeoperacoesv3completo-eef50.xlsx')
  const buf = fs.readFileSync(filePath)
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true, cellFormula: true })

  console.log('SheetNames:', wb.SheetNames)

  const outObj: Record<string, string[]> = {}
  for (const name of wb.SheetNames) {
    outObj[name] = []
    const s = wb.Sheets[name]
    if (!s || !s['!ref']) continue
    const range = XLSX.utils.decode_range(s['!ref'])
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const rowCells: string[] = []
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C })
        const cell = s[cellRef]
        if (cell && (cell.v !== undefined || cell.f !== undefined)) {
          const formulaStr = cell.f ? ` [FORMULA: =${cell.f}]` : ''
          rowCells.push(`${cellRef}=${JSON.stringify(cell.v)}${formulaStr}`)
        }
      }
      if (rowCells.length > 0) {
        outObj[name].push(`L${R + 1}: ${rowCells.join(' | ')}`)
      }
    }
  }
  console.log('Finished reading sheets:', Object.keys(outObj))
}
