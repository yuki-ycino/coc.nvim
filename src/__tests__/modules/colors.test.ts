import helper from '../helper'
import { Neovim } from '@chemzqm/neovim'
import { Color, Range, TextDocument, CancellationToken, ColorInformation, ColorPresentation } from 'vscode-languageserver-protocol'
import Colors from '../../colors'
import languages from '../../languages'
import { ProviderResult } from '../../provider'

let nvim: Neovim
let state = 'normal'
let colors: Colors
beforeAll(async () => {
  await helper.setup()
  nvim = helper.nvim
  colors = (helper.plugin as any).handler.colors

  languages.registerDocumentColorProvider([{ language: '*' }], {
    provideColorPresentations: (
      _color: Color,
      _context: { document: TextDocument; range: Range },
      _token: CancellationToken
    ): ColorPresentation[] => {
      return [ColorPresentation.create('red'), ColorPresentation.create('#ff0000')]
    },
    provideDocumentColors: (
      _document: TextDocument,
      _token: CancellationToken
    ): ProviderResult<ColorInformation[]> => {
      if (state == 'empty') return []
      if (state == 'error') return Promise.reject(new Error('no color'))
      return [{
        range: Range.create(0, 0, 0, 7),
        color: getColor(255, 255, 255)
      }]
    }
  })
})

afterAll(async () => {
  await helper.shutdown()
})

afterEach(async () => {
  await helper.reset()
})

function getColor(r: number, g: number, b: number): Color {
  return { red: r / 255, green: g / 255, blue: b / 255, alpha: 1 }
}

describe('Colors', () => {

  it('should get hex string', () => {
    let color = getColor(255, 255, 255)
    let hex = colors.toHexString(color)
    expect(hex).toBe('ffffff')
  })

  it('should toggle enable state on configuration change', () => {
    helper.updateDefaults('coc.preferences.colorSupport', false)
    expect(colors.enabled).toBe(false)
    helper.updateDefaults('coc.preferences.colorSupport', true)
    expect(colors.enabled).toBe(true)
  })

  it('should highlight on CursorHold', async () => {
    let buf = await helper.edit('tmp')
    await nvim.setLine('#ffffff')
    await helper.wait(600)
    expect(colors.hasColor(buf.id)).toBe(true)
  })

  it('should clearHighlight on empty result', async () => {
    let doc = await helper.createDocument('tmp')
    await nvim.setLine('#ffffff')
    state = 'empty'
    await colors.highlightColors(doc)
    let res = colors.hasColor(doc.bufnr)
    expect(res).toBe(false)
    state = 'normal'
  })

  it('should clearHighlight on error result', async () => {
    let doc = await helper.createDocument('tmp')
    await nvim.setLine('#ffffff')
    state = 'error'
    await colors.highlightColors(doc)
    let res = colors.hasColor(doc.bufnr)
    expect(res).toBe(false)
    state = 'normal'
  })

  it('should clearHighlight on clearHighlight', async () => {
    let doc = await helper.createDocument('tmp')
    await nvim.setLine('#ffffff')
    await colors.highlightColors(doc)
    expect(colors.hasColor(doc.bufnr)).toBe(true)
    await colors.clearHighlight(doc.bufnr)
    expect(colors.hasColor(doc.bufnr)).toBe(false)
  })

  it('should highlight colors', async () => {
    let doc = await helper.createDocument('test')
    await nvim.setLine('#ffffff')
    let colorSet = false
    helper.on('highlight_set', args => {
      let color = args[0][0]
      if (color.foreground == 0 && color.background == 16777215) {
        colorSet = true
      }
    })
    await colors.highlightColors(doc)
    let exists = await nvim.call('hlexists', 'BGffffff')
    expect(exists).toBe(1)
    expect(colorSet).toBe(true)
  })

  it('should pick presentations', async () => {
    let doc = await helper.createDocument('test')
    await nvim.setLine('#ffffff')
    await colors.highlightColors(doc)
    let p = colors.pickPresentation()
    await helper.wait(100)
    let m = await nvim.mode
    expect(m.blocking).toBe(true)
    await nvim.input('1<enter>')
    await p
    let line = await nvim.getLine()
    expect(line).toBe('red')
  })

  it('should pickColor', async () => {
    await helper.mockFunction('coc#util#pick_color', [0, 0, 0])
    let doc = await helper.createDocument('test')
    await nvim.setLine('#ffffff')
    await colors.highlightColors(doc)
    await colors.pickColor()
    let line = await nvim.getLine()
    expect(line).toBe('#000000')
  })
})
