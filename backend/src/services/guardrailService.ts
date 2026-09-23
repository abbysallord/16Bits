/**
 * 16Bits OmniOps — Enterprise Safety & Compliance Guardrails
 * 
 * Provides automated input sanitization (PII/Secret redaction, Prompt Injection defense)
 * and output verification (Destructive command interception, dry-run enforcement, zero-emoji compliance).
 */

export interface SanitizedInput {
  title: string
  description: string
  redactionsCount: number
  injectionsNeutralized: number
  isSafe: boolean
}

export interface OutputAuditResult {
  cleanedText: string
  isDestructive: boolean
  flaggedCommands: string[]
  requiresEscalatedApproval: boolean
}

export class GuardrailService {
  // Regex patterns for sensitive credentials & PII
  private static SECRET_PATTERNS = [
    { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED_AWS_KEY]' },
    { name: 'Bearer Token', regex: /Bearer\s+[A-Za-z0-9\-_.]+/gi, replacement: 'Bearer [REDACTED_TOKEN]' },
    { name: 'Generic API Secret', regex: /(api_key|apikey|secret|password|passwd|token)\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{8,}['"]?/gi, replacement: '$1: [REDACTED_SECRET]' },
    { name: 'Database URI with Password', regex: /(postgres|mysql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@/gi, replacement: '$1://[USER]:[REDACTED_PASSWORD]@' },
    { name: 'Private Key Block', regex: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' }
  ]

  // Prompt injection markers
  private static INJECTION_PATTERNS = [
    /ignore (all )?(previous|prior) (instructions|prompts|rules)/gi,
    /system override/gi,
    /you are now in developer mode/gi,
    /you must disregard all safety rules/gi,
    /jailbreak/gi,
    /DAN mode/gi
  ]

  // Dangerous / Destructive command patterns that MUST be flagged and quarantined
  private static DESTRUCTIVE_COMMANDS = [
    { pattern: /rm\s+-rf\s+(\/|\*|~|\$HOME)/i, label: 'Recursive root filesystem deletion (rm -rf /)' },
    { pattern: /drop\s+database\s+/i, label: 'Destructive SQL database drop (DROP DATABASE)' },
    { pattern: /truncate\s+table\s+/i, label: 'Destructive table wipe (TRUNCATE TABLE)' },
    { pattern: /mkfs(\.[a-z0-9]+)?\s+/i, label: 'Drive format execution (mkfs)' },
    { pattern: /dd\s+if=.*of=\/dev\/(sd[a-z]|nvme[0-9]|null)/i, label: 'Raw block device override (dd)' },
    { pattern: /:(){ :|:& };:/i, label: 'Fork bomb exploit' },
    { pattern: /flushall\s+--force/i, label: 'Forced Redis cache wipe' },
    { pattern: /chmod\s+-R\s+777\s+\//i, label: 'Unrestricted root permission vulnerability' }
  ]

  // Emoji regex to enforce strict ZERO EMOJI rule
  private static EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu

  /**
   * Sanitizes incident titles and raw error logs before LLM processing
   */
  public sanitizeInput(title: string, description: string): SanitizedInput {
    let cleanTitle = title
    let cleanDesc = description
    let redactionsCount = 0
    let injectionsNeutralized = 0

    // 1. Redact Secrets & PII
    for (const pattern of GuardrailService.SECRET_PATTERNS) {
      const titleMatches = cleanTitle.match(pattern.regex)
      if (titleMatches) {
        redactionsCount += titleMatches.length
        cleanTitle = cleanTitle.replace(pattern.regex, pattern.replacement)
      }

      const descMatches = cleanDesc.match(pattern.regex)
      if (descMatches) {
        redactionsCount += descMatches.length
        cleanDesc = cleanDesc.replace(pattern.regex, pattern.replacement)
      }
    }

    // 2. Neutralize Prompt Injection attempts
    for (const pattern of GuardrailService.INJECTION_PATTERNS) {
      if (pattern.test(cleanTitle)) {
        injectionsNeutralized++
        cleanTitle = cleanTitle.replace(pattern, '[INJECTION_FLAGGED_AND_NEUTRALIZED]')
      }
      if (pattern.test(cleanDesc)) {
        injectionsNeutralized++
        cleanDesc = cleanDesc.replace(pattern, '[INJECTION_FLAGGED_AND_NEUTRALIZED]')
      }
    }

    return {
      title: cleanTitle,
      description: cleanDesc,
      redactionsCount,
      injectionsNeutralized,
      isSafe: injectionsNeutralized === 0
    }
  }

  /**
   * Audits LLM generated playbooks and commands for destructive operations and emoji compliance
   */
  public auditOutput(text: string): OutputAuditResult {
    let cleanedText = text
    const flaggedCommands: string[] = []

    // 1. Check for destructive commands
    for (const cmd of GuardrailService.DESTRUCTIVE_COMMANDS) {
      if (cmd.pattern.test(cleanedText)) {
        flaggedCommands.push(cmd.label)
      }
    }

    // 2. Strip any accidental emojis to preserve strict terminal & enterprise NES compliance
    cleanedText = cleanedText.replace(GuardrailService.EMOJI_REGEX, '')

    return {
      cleanedText,
      isDestructive: flaggedCommands.length > 0,
      flaggedCommands,
      requiresEscalatedApproval: flaggedCommands.length > 0
    }
  }
}

export const guardrailService = new GuardrailService()
