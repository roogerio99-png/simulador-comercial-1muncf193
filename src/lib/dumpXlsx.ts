import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

const filePath = path.resolve(process.cwd(), 'src/assets/simuladordeoperacoesv3completo-eef50.xlsx')
const buf = fs.readFileSync(filePath)
const wb = XLSX.read(buf, { type: 'buffer', cellDates: true, cellFormula: true })

console.log('SheetNames:', wb.SheetNames)

for (const name of wb.SheetNames) {
  console.log(`\n=================== ABA: ${name} ===================`)
  const s = wb.Sheets[name]
  if (!s || !s['!ref']) {
    console.log('Aba vazia ou sem !ref')
    continue
  }
  const range = XLSX.utils.decode_range(s['!ref'])
  console.log(`Range: ${s['!ref']} (rows: ${range.s.r + 1} to ${range.e.r + 1}, cols: ${range.s.c + 1} to ${range.e.c + 1})`)

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
      console.log(`L${R + 1}: ${rowCells.join(' | ')}`)
    }
  }
}
