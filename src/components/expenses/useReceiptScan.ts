import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import { scanReceipt, type ReceiptScanResult } from '@/lib/aiAdvisor'
import { t } from '@/lib/utils'

/**
 * Receipt scan shared by ExpenseDialog and QuickAddSheet. The flow is exactly
 * the v3.1 one: read the picked image as base64 (prefix stripped), call
 * `scanReceipt(base64, mime, lang)`, hand the result to `onResult`. The image
 * is never stored.
 */
export function useReceiptScan(lang: 'en' | 'he', onResult: (result: ReceiptScanResult) => void) {
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const openPicker = useCallback(() => {
    setScanError(null)
    fileInputRef.current?.click()
  }, [])

  const reset = useCallback(() => {
    setScanError(null)
    setScanning(false)
  }, [])

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset so the same file can be re-selected after an error
    e.target.value = ''

    setScanError(null)
    setScanning(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Strip the "data:<mime>;base64," prefix
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const result = await scanReceipt(base64, file.type || 'image/jpeg', lang)
      onResult(result)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      console.error('[scanReceipt]', detail)
      setScanError(t('Could not read receipt.', 'לא ניתן לקרוא את הקבלה.', lang) + ` — ${detail}`)
    } finally {
      setScanning(false)
    }
  }

  /** Spread onto a hidden `<input>`. */
  const inputProps = {
    ref: fileInputRef,
    type: 'file' as const,
    accept: 'image/*,application/pdf',
    capture: 'environment' as const,
    className: 'hidden',
    'aria-hidden': true,
    tabIndex: -1,
    onChange: handleFile,
  }

  return { scanning, scanError, setScanError, openPicker, reset, inputProps }
}
