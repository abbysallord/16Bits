import fs from 'fs'
import path from 'path'

export interface Runbook {
  filename: string
  title: string
  content: string
}

export class RunbookService {
  private runbooksDir: string

  constructor() {
    this.runbooksDir = path.resolve(process.cwd(), 'runbooks')
  }

  public getAvailableRunbooks(): Runbook[] {
    if (!fs.existsSync(this.runbooksDir)) {
      return []
    }

    const files = fs.readdirSync(this.runbooksDir).filter(f => f.endsWith('.md'))
    return files.map(file => {
      const filePath = path.join(this.runbooksDir, file)
      const content = fs.readFileSync(filePath, 'utf-8')
      const firstLine = content.split('\n')[0] || file
      const title = firstLine.replace(/^#\s*/, '').trim()
      return {
        filename: file,
        title,
        content
      }
    })
  }

  public findBestRunbook(query: string): Runbook | null {
    const runbooks = this.getAvailableRunbooks()
    if (runbooks.length === 0) return null

    const lowerQuery = query.toLowerCase()

    // Simple keyword score match
    let bestMatch: Runbook | null = null
    let highestScore = -1

    for (const rb of runbooks) {
      let score = 0
      const contentLower = rb.content.toLowerCase()
      const titleLower = rb.title.toLowerCase()

      const keywords = lowerQuery.split(/\s+/).filter(w => w.length > 3)
      for (const kw of keywords) {
        if (titleLower.includes(kw)) score += 5
        if (contentLower.includes(kw)) score += 1
      }

      if (score > highestScore) {
        highestScore = score
        bestMatch = rb
      }
    }

    // Default to first runbook if score is 0
    return highestScore > 0 ? bestMatch : runbooks[0]
  }
}

export const runbookService = new RunbookService()
