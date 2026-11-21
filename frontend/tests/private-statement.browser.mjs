import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(process.env.FINSIGHT_PLAYWRIGHT
  ? pathToFileURL(process.env.FINSIGHT_PLAYWRIGHT).href : 'playwright')
const origin = process.env.FINSIGHT_SMOKE_ORIGIN ?? 'http://127.0.0.1:8000'
const browser = await chromium.launch({ executablePath: process.env.FINSIGHT_CHROME })
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' })
  page.setDefaultTimeout(8000)
  const errors = []
  const analysisRequests = []
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/private-statement')) analysisRequests.push(request)
  })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(origin)
  const syntheticTimeline = page.getByRole('region', { name: 'Subscription timeline' })
  await syntheticTimeline.locator('.milestone-event').first().waitFor()
  await page.getByRole('button', { name: 'Forecast', exact: true }).click()
  const forecast = page.getByRole('region', { name: 'Estimated obligations' })
  await forecast.getByRole('heading', { name: '30-day debit calendar' }).waitFor()
  const savings = forecast.getByLabel('Estimated annual savings')
  const beforeSavings = await savings.innerText()
  await forecast.getByRole('checkbox').first().check()
  assert.notEqual(await savings.innerText(), beforeSavings)
  const buffer = forecast.getByRole('region', { name: 'Cash buffer planner' })
  await buffer.getByLabel('Starting balance').fill('1000')
  await buffer.getByLabel('Minimum balance buffer').fill('100')
  await buffer.getByText(/Projected balance|Starting balance: /).first().waitFor()
  await forecast.getByRole('checkbox', { name: 'Show in-app reminders' }).check()
  await forecast.getByLabel('Reminder window').selectOption('14')
  await page.reload()
  await page.getByRole('button', { name: 'Forecast', exact: true }).click()
  assert.equal(await forecast.getByLabel('Reminder window').inputValue(), '14')
  await forecast.getByRole('checkbox', { name: 'Show in-app reminders' }).uncheck()
  await page.getByRole('button', { name: 'Evaluation & audit' }).click()
  await page.getByRole('button', { name: 'False positives 4' }).click()
  assert.equal(await page.locator('.benchmark-row').count(), 4)
  await page.getByRole('button', { name: 'Import statement' }).click()
  const fixture = {
    name: 'synthetic-import-smoke.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Day,Payee,Value,Route\n' +
      ['01', '02', '03', '04'].map(month => `05/${month}/2025,Private Synthetic Gym,-420,Card\n`).join('') +
      '12/01/2025,Paper Desk,-80,Card\n12/02/2025,Paper Desk,-80,Card\n' +
      '12/03/2025,Paper Desk Online,-80,Card\n12/04/2025,Paper Desk Online,-80,Card\n' +
      '12/05/2025,Paper-Desk Online,-80,Card\n' +
      '06/01/2025,Private Synthetic Gym Refund,420,Card\n',
    ),
  }
  const dropzone = page.getByRole('region', { name: 'CSV dropzone' })
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    data.items.add(new File(['date,description,amount\n2025-01-15,Synthetic Desk,-100'], 'drop-preview.csv', { type: 'text/csv' }))
    return data
  })
  await dropzone.dispatchEvent('dragenter', { dataTransfer: transfer })
  await dropzone.locator('label').dispatchEvent('dragenter', { dataTransfer: transfer })
  await dropzone.locator('label').dispatchEvent('dragleave', { dataTransfer: transfer })
  assert.match(await dropzone.getAttribute('class'), /is-dragging/)
  await dropzone.dispatchEvent('dragover', { dataTransfer: transfer })
  await dropzone.dispatchEvent('drop', { dataTransfer: transfer })
  await page.getByRole('region', { name: 'Statement preview' }).waitFor()
  assert.match(await dropzone.innerText(), /drop-preview.csv/)
  assert.doesNotMatch(await dropzone.getAttribute('class'), /is-dragging/)
  await page.getByLabel('Statement CSV').setInputFiles({
    name: 'replacement-preview.csv', mimeType: 'text/csv',
    buffer: Buffer.from('date,description,amount\n2025-01-15,Replacement Desk,-200'),
  })
  await page.getByText('Replacement Desk', { exact: true }).waitFor()
  assert.match(await dropzone.innerText(), /replacement-preview.csv/)
  assert.doesNotMatch(await dropzone.innerText(), /drop-preview.csv/)
  await page.getByRole('button', { name: 'Clear preview', exact: true }).click()
  assert.doesNotMatch(await dropzone.innerText(), /replacement-preview.csv/)
  await page.getByLabel('Statement CSV').focus()
  assert.equal(await page.getByLabel('Statement CSV').evaluate(element => element === document.activeElement), true)
  await transfer.dispose()
  // Content and selection failures recover without uploading anything.
  for (const [name, buffer, message] of [
    ['empty.csv', Buffer.alloc(0), /empty/],
    ['invalid.csv', Buffer.from([0xff, 0xfe, 0xff]), /encoded data|UTF-8/i],
    ['broken.csv', Buffer.from('date,description,amount\n"unterminated'), /quoting/],
    ['oversized.csv', Buffer.alloc(2_000_001, 120), /2 MB/],
  ]) {
    await page.getByLabel('Statement CSV').setInputFiles({ name, mimeType: 'text/csv', buffer })
    await page.getByRole('alert').waitFor()
    assert.match(await page.getByRole('alert').innerText(), message)
    assert.equal(await page.getByRole('region', { name: 'Statement preview' }).count(), 0)
  }
  const multiple = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    for (const name of ['first.csv', 'second.csv']) data.items.add(new File(['a\nb'], name))
    return data
  })
  await dropzone.dispatchEvent('drop', { dataTransfer: multiple })
  assert.match(await page.getByRole('alert').innerText(), /one CSV/)
  await multiple.dispose()

  // Delay a real local read, cancel it, replace it, then release the old bytes.
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer
    window.restoreFileRead = () => { File.prototype.arrayBuffer = original }
    File.prototype.arrayBuffer = function () {
      if (this.name !== 'slow-read.csv') return original.call(this)
      return new Promise(resolve => { window.releaseFileRead = () => original.call(this).then(resolve) })
    }
  })
  await page.getByLabel('Statement CSV').setInputFiles({
    name: 'slow-read.csv', mimeType: 'text/csv', buffer: Buffer.from('old,date\na,b'),
  })
  await page.getByRole('button', { name: 'Cancel processing' }).click()
  assert.match(await page.getByRole('status').innerText(), /Cancelled/)
  const picker = page.waitForEvent('filechooser')
  await page.getByLabel('Statement CSV').press('Space')
  await (await picker).setFiles(fixture)
  await page.getByRole('region', { name: 'Statement preview' }).waitFor()
  await page.evaluate(async () => { await window.releaseFileRead(); window.restoreFileRead() })
  assert.match(await dropzone.innerText(), /synthetic-import-smoke.csv/)
  assert.doesNotMatch(await dropzone.innerText(), /slow-read.csv/)
  await page.getByLabel('Date', { exact: true }).selectOption('0')
  await page.getByLabel('Merchant or description').selectOption('1')
  await page.getByLabel('Amount', { exact: true }).selectOption('2')
  await page.getByLabel('Payment method').selectOption('3')
  await page.getByLabel('Date format').selectOption('dmy')
  assert.equal(analysisRequests.length, 0, 'selection, preview and cancellation must remain local')
  // Cancellation of an in-flight mapped analysis must not navigate on a late response.
  let releaseAnalysis
  let analysisStarted
  const started = new Promise(resolve => { analysisStarted = resolve })
  const delayed = new Promise(resolve => { releaseAnalysis = resolve })
  await page.route('**/api/private-statement', async route => {
    analysisStarted()
    const response = await route.fetch()
    await delayed
    await route.fulfill({ response }).catch(() => {}) // Client may already have aborted.
  })
  await page.getByRole('button', { name: 'Analyze statement' }).click()
  await started
  await page.getByRole('button', { name: 'Cancel processing' }).click()
  releaseAnalysis()
  await page.unrouteAll({ behavior: 'wait' })
  await page.getByRole('heading', { name: 'Preview and map fields' }).waitFor()
  assert.equal(await page.getByText('Private statement data', { exact: true }).count(), 0)
  await page.getByRole('button', { name: 'Analyze statement' }).click()
  await page.getByText('Private statement data', { exact: true }).waitFor()
  const timeline = page.getByRole('region', { name: 'Subscription timeline' })
  const event = timeline.locator('.milestone-event').first()
  assert.match(await event.innerText(), /Private Synthetic Gym/)
  await event.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('heading', { name: 'Private Synthetic Gym', exact: true }).waitFor()
  await dialog.getByRole('checkbox').first().check()
  assert.equal(await page.evaluate(() => localStorage.getItem('finsight_mandate_revocations_v1')), null)
  for (const check of await dialog.getByRole('checkbox').all()) await check.check()
  await dialog.getByRole('button', { name: 'Mark as revoked', exact: true }).click()
  await dialog.getByRole('heading', { name: 'Commitment activity' }).waitFor()
  await dialog.getByText('No linked debits appear after that day in the loaded records.', { exact: false }).waitFor()
  const downloaded = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download this activity' }).click()
  const activity = JSON.parse(await readFile(await (await downloaded).path(), 'utf8'))
  assert.equal(activity.events.length, 1)
  assert.equal(activity.events[0].kind, 'revocation-report')
  assert.equal(await page.evaluate(() => localStorage.getItem('finsight_mandate_revocations_v1')), null)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Transactions', exact: true }).click()
  const refund = page.getByRole('row').filter({ hasText: 'Private Synthetic Gym Refund' })
  await refund.getByText('Possible refund', { exact: true }).waitFor()
  await refund.getByText('credit', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Import statement' }).click()
  const suggested = page.getByRole('list', { name: 'Suggested merchant links' })
  await suggested.getByRole('button', { name: 'Dismiss Paper-Desk Online → Paper Desk Online' }).click()
  await page.getByRole('list', { name: 'Dismissed merchant suggestions' }).waitFor()
  await page.getByRole('button', { name: 'Restore suggestion' }).click()
  await suggested.locator('button:not([disabled])').filter({ hasText: 'Confirm link' })
    .and(suggested.getByRole('button', { name: 'Confirm Paper-Desk Online → Paper Desk Online' })).click()
  await page.getByRole('button', { name: 'Remove link for Paper-Desk Online' }).click()
  await suggested.locator('button:not([disabled])')
    .and(suggested.getByRole('button', { name: 'Confirm Paper-Desk Online → Paper Desk Online' })).waitFor()
  const linkForm = page.locator('fieldset:not([disabled])').filter({ hasText: 'Confirm a descriptor link' })
  await linkForm.getByLabel('Variant descriptor').selectOption('Paper Desk Online')
  await linkForm.getByLabel('Keep as merchant').selectOption('Paper Desk')
  await page.getByRole('button', { name: 'Link and reanalyze' }).click()
  await page.getByRole('list', { name: 'Merchant links', exact: true }).waitFor()
  await page.getByRole('button', { name: /Recurring payments/ }).click()
  await page.getByRole('row').filter({ hasText: 'Paper Desk' }).first().waitFor()
  await page.getByRole('button', { name: 'Import statement' }).click()
  await page.getByRole('button', { name: 'Remove link for Paper Desk Online' }).click()
  await page.getByRole('list', { name: 'Merchant links', exact: true }).waitFor({ state: 'hidden' })
  await page.getByLabel('Statement CSV').setInputFiles(fixture)
  await page.getByRole('region', { name: 'Statement preview' }).waitFor()
  await page.getByLabel('Date', { exact: true }).selectOption('0')
  await page.getByLabel('Merchant or description').selectOption('1')
  await page.getByLabel('Amount', { exact: true }).selectOption('2')
  await page.getByLabel('Payment method').selectOption('3')
  await page.getByLabel('Date format').selectOption('dmy')
  await page.getByRole('checkbox', { name: /Combine with the current statement/ }).check()
  await page.getByRole('button', { name: 'Review overlap' }).click()
  await page.getByRole('heading', { name: 'Review overlapping rows' }).waitFor()
  await page.getByText('10 exact matches to skip, 0 other rows to add, and 0 possible conflicts.').waitFor()
  await page.getByRole('button', { name: 'Apply reviewed overlap' }).click()
  await page.getByText('Combined statement exports. Skipped 10 matching rows.', { exact: true }).waitFor()
  if (process.env.FINSIGHT_LOCAL_DB) {
    await page.getByRole('button', { name: 'Import statement' }).click()
    await suggested.getByRole('button', { name: 'Dismiss Paper-Desk Online → Paper Desk Online' }).click()
    await page.getByRole('list', { name: 'Dismissed merchant suggestions' }).waitFor()
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Save locally' }).click()
    await page.getByText('Statement saved locally.').waitFor()
    const exportReady = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export mapped data' }).click()
    assert.equal((await exportReady).suggestedFilename(), 'finsight-private-statement.json')
    await page.getByRole('button', { name: 'Clear private statement' }).click()
    await page.reload()
    await page.getByRole('button', { name: 'Import statement' }).click()
    await page.getByLabel('Statement CSV').setInputFiles({
      name: 'second-account.csv', mimeType: 'text/csv',
      buffer: Buffer.from('date,description,amount\n2025-01-10,Synthetic Business Debit,-100\n'),
    })
    await page.getByRole('button', { name: 'Analyze statement' }).click()
    await page.getByText('Private statement data', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Import statement' }).click()
    await page.getByLabel('Saved account nickname').fill('Business')
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Save locally' }).click()
    await page.getByText('Statement saved locally.').waitFor()
    await page.getByRole('button', { name: 'Clear private statement' }).click()
    await page.getByRole('button', { name: 'Import statement' }).click()
    await page.getByRole('button', { name: 'List saved accounts' }).click()
    const savedAccounts = page.getByRole('list', { name: 'Saved accounts' })
    await savedAccounts.getByRole('button', { name: 'Business', exact: true }).waitFor()
    const overview = page.getByRole('region', { name: 'Combined account overview' })
    await overview.getByRole('checkbox', { name: 'Business' }).check()
    await overview.getByRole('checkbox', { name: 'Default workspace' }).check()
    await overview.getByRole('button', { name: 'Compare selected accounts' }).click()
    await overview.getByRole('heading', { name: 'Totals by currency' }).waitFor()
    await overview.getByText(/Business · 1 transactions · 0 inferred commitments/).waitFor()
    await savedAccounts.getByRole('button', { name: 'Default workspace', exact: true }).click()
    await page.getByRole('button', { name: 'Restore saved statement' }).click()
    await page.getByText('Private statement data', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Import statement' }).click()
    await page.getByRole('list', { name: 'Dismissed merchant suggestions' }).waitFor()
    await page.getByRole('button', { name: 'List saved accounts' }).click()
    await savedAccounts.getByRole('button', { name: 'Default workspace', exact: true }).waitFor()
    await page.getByLabel('Saved account nickname').fill('Ｄｅｆａｕｌｔ workspace')
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Delete saved statement' }).click()
    await page.getByText('Saved statement deleted.').waitFor()
    assert.equal(await savedAccounts.getByRole('button', { name: 'Default workspace', exact: true }).count(), 0)
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Restore saved statement' }).click()
    await page.getByText('No statement has been saved.').waitFor()
    await page.getByLabel('Saved account nickname').fill('Business')
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Restore saved statement' }).click()
    await page.getByRole('heading', { name: 'Recurring charges in your history.', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Transactions', exact: true }).click()
    await page.getByText('Synthetic Business Debit', { exact: true }).waitFor()
    assert.equal(await page.getByText('Private Synthetic Gym', { exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Import statement' }).click()
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Delete saved statement' }).click()
    await page.getByText('Saved statement deleted.').waitFor()
    console.log('PASS: explicit SQLite save, JSON download, reload and restore, and saved statement deletion')
  }
  await page.getByRole('button', { name: 'Clear private statement' }).click()
  await page.getByText('Synthetic transaction data', { exact: true }).waitFor()
  assert.equal(await page.getByText('Private Synthetic Gym').count(), 0)
  await page.reload()
  assert.equal(await page.getByText('Private Synthetic Gym').count(), 0)
  assert.deepEqual(errors, [])
  await page.getByRole('button', { name: 'Import statement' }).click()
  await page.getByLabel('Statement CSV').setInputFiles({
    name: 'synthetic-review.csv', mimeType: 'text/csv',
    buffer: Buffer.from(
      'date,description,amount\n2025-01-05,Review Desk,-100\n2025-02-05,Review Desk,-100\n' +
      '2025-04-05,Review Desk,-120\n2025-05-05,Review Desk,-120\n' +
      '2025-03-01,Review Shop,-40\n2025-03-01,Review Shop,-40\n2025-03-01,Review Shop,40\n',
    ),
  })
  await page.getByRole('button', { name: 'Analyze statement' }).click()
  await page.getByText('Private statement data', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Review', exact: true }).click()
  await page.getByLabel('Review type').selectOption('possible_duplicate')
  await page.getByText('Possible duplicate debit: Review Shop', { exact: true }).click()
  const supporting = page.getByRole('list', { name: 'Supporting transactions' })
  assert.equal(await supporting.getByRole('listitem').count(), 2)
  await page.getByLabel('Review type').selectOption('charge_after_gap')
  await page.getByText('Charge after a gap: Review Desk', { exact: true }).click()
  assert.equal(await supporting.getByRole('listitem').count(), 3)
  await page.getByRole('button', { name: 'Open commitment' }).click()
  await page.getByRole('dialog').getByRole('heading', { name: 'Review Desk', exact: true }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Ask FinSight', exact: true }).click()
  await page.getByRole('button', { name: 'Which subscriptions became more expensive?' }).click()
  await page.getByText('Recent amount changed: Review Desk', { exact: true }).click()
  assert.equal(await page.getByRole('list', { name: 'Supporting transactions' }).getByRole('listitem').count(), 4)
  await page.getByRole('button', { name: 'Open Review', exact: true }).click()
  await page.getByRole('heading', { name: 'Review transaction evidence' }).waitFor()
  await page.getByRole('button', { name: 'Clear private statement' }).click()
  assert.deepEqual(errors, [])
  console.log('PASS: nested drop feedback, invalid files, replacement/removal, keyboard picker, cancelled read/analysis and late responses')
  console.log('PASS: private CSV preview, mapping, analysis, merchant link and removal, volatile checklist, clear, and reload')
} finally {
  await browser.close()
}
