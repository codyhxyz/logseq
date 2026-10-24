// Run against `clojure -M:cljs watch app db-worker` and the webpack worker bundle.
const { chromium, _electron: electron } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

async function main () {
  const desktop = Boolean(process.env.LOGSEQ_ELECTRON_EXECUTABLE)
  const browser = desktop
    ? await electron.launch({
      executablePath: process.env.LOGSEQ_ELECTRON_EXECUTABLE,
      env: { ...process.env, LOGSEQ_INLINE_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'logseq-inline-test-')) },
    })
    : await chromium.launch({
      ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
    })
  const page = desktop ? await browser.firstWindow()
    : await browser.newPage({ viewport: { width: 1440, height: 1080 } })
  try {
    page.setDefaultTimeout(15000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    if (!desktop) await page.goto(process.env.LOGSEQ_TEST_URL || 'http://localhost:3001')
    await page.waitForFunction(() => window.logseq?.api?.get_current_graph())
    const fixture = await page.evaluate(async () => {
      const api = logseq.api
      const home = await api.create_page('Inline expansion home', null, { redirect: false })
      const questions = await api.create_page('Good questions', null, { redirect: false })
      const experiments = await api.create_page('Small experiments', null, { redirect: false })
      const empty = await api.create_page('Empty page', null, { redirect: false })
      const source = await api.insert_block(home.uuid,
        `Start with [[${questions.uuid}]] and again [[${questions.uuid}]]. [[${empty.uuid}]]`,
        { sibling: false })
      const question = await api.insert_block(questions.uuid,
        `What would make this idea worth trying? [[${experiments.uuid}]]`,
        { sibling: false })
      const experiment = await api.insert_block(experiments.uuid,
        `Bring what I learned back to [[${home.uuid}]].`,
        { sibling: false })
      api.push_state('page', { name: home.uuid })
      return { home, questions, experiments, empty, source, question, experiment }
    })
    const sourceRow = page.locator(`.ls-block[blockid="${fixture.source.uuid}"]`).first()
    const refs = sourceRow.locator(':scope > .block-main-container a.page-ref')
    const questionRefs = refs.filter({ hasText: 'Good questions' })
    await questionRefs.first().click()
    const firstPanel = page.locator(`.ls-inline-expansion[data-target="${fixture.questions.uuid}"]`).first()
    await firstPanel.locator('.block-content').filter({ hasText: 'What would make' }).waitFor()
    assert.equal(await page.locator('.ls-inline-expansion').count(), 1)
    assert.equal(await questionRefs.first().getAttribute('aria-expanded'), 'true')
    await questionRefs.nth(1).click()
    await page.waitForFunction(() => document.querySelectorAll('.ls-inline-expansion').length === 2)
    const questionRows = page.locator(`.ls-inline-expansion .ls-block[blockid="${fixture.question.uuid}"]`)
    assert.equal(await questionRows.count(), 2)
    // Only the clicked occurrence may enter editing, despite duplicate block UUIDs.
    await questionRows.first().locator('.block-content').first().click({ position: { x: 20, y: 10 } })
    const editor = page.locator('textarea[id^="edit-block-"]')
    await editor.waitFor()
    assert.equal(await editor.count(), 1)
    assert.equal(await firstPanel.locator('textarea[id^="edit-block-"]').count(), 1)
    await editor.fill(`An edited question. [[${fixture.experiments.uuid}]]`)
    await editor.press('Escape')
    await page.waitForFunction(() => [...document.querySelectorAll('.ls-inline-expansion .block-content')]
      .filter(n => n.textContent.includes('An edited question.')).length === 2)
    // Follow a nested reference and reject only the ancestor cycle.
    await firstPanel.locator('a.page-ref').filter({ hasText: 'Small experiments' }).click()
    const experimentPanel = firstPanel.locator(`.ls-inline-expansion[data-target="${fixture.experiments.uuid}"]`)
    await experimentPanel.locator('a.page-ref').filter({ hasText: 'Inline expansion home' }).click()
    const cycle = experimentPanel.locator('.ls-inline-expansion[data-cycle="true"]')
    await cycle.waitFor()
    assert.equal(await cycle.locator('.ls-block').count(), 0)
    assert.match(await cycle.innerText(), /already open above/)
    // Create an actual new page using native [[ autocomplete inside a nested editor.
    const experimentRow = experimentPanel.locator(`.ls-block[blockid="${fixture.experiment.uuid}"]`)
    await experimentRow.locator('.block-content').click({ position: { x: 20, y: 10 } })
    await editor.fill('Follow ')
    await editor.press('End')
    await editor.pressSequentially('[[Fresh nested idea', { delay: 30 })
    const newPageChoice = page.getByText('New page Fresh nested idea', { exact: false })
    await newPageChoice.waitFor()
    await editor.press('Enter')
    await page.waitForFunction(async () => Boolean((await logseq.api.get_page('Fresh nested idea'))?.uuid))
    // Closing flushes the native editor even if autocomplete still owns focus.
    await experimentPanel.locator(':scope > .ls-inline-expansion-header button').click()
    await firstPanel.locator('a.page-ref').filter({ hasText: 'Small experiments' }).click()
    await experimentRow.locator('a.page-ref').filter({ hasText: 'Fresh nested idea' }).waitFor()
    const createdPage = await page.evaluate(() => logseq.api.get_page('Fresh nested idea'))
    assert(createdPage?.uuid, 'Native autocomplete must create a persisted page')
    await experimentRow.locator('a.page-ref').filter({ hasText: 'Fresh nested idea' }).click()
    const freshPanel = experimentPanel.locator(`.ls-inline-expansion[data-target="${createdPage.uuid}"]`)
    await freshPanel.waitFor()
    // A newly created empty page must have the native add-block affordance.
    assert.match(await freshPanel.innerText(), /Fresh nested idea/)
    await freshPanel.locator('.block-add-button').click()
    await freshPanel.locator('textarea[id^="edit-block-"]').waitFor()
    await editor.fill('A thought written three levels deep.')
    await editor.press('Escape')
    await freshPanel.locator('.block-content').filter({ hasText: 'A thought written three levels deep.' }).waitFor()
    const freshBlocks = await page.evaluate(uuid => logseq.api.get_page_blocks_tree(uuid), createdPage.uuid)
    assert(freshBlocks.some(block => block.content.includes('A thought written three levels deep.')))
    const outputDir = path.resolve(__dirname, '../tmp/inline-expansion-evidence')
    fs.mkdirSync(outputDir, { recursive: true })
    await page.screenshot({ path: path.join(outputDir, 'nested-editors.png'), fullPage: true })
    // Closing while typing must persist through the normal editor lifecycle.
    await questionRows.first().locator('.block-content').first().click({ position: { x: 20, y: 10 } })
    await editor.fill('Saved when closing the expansion.')
    await firstPanel.locator(':scope > .ls-inline-expansion-header button').click()
    await page.waitForFunction(uuid => {
      const rows = [...document.querySelectorAll(`.ls-block[blockid="${uuid}"] .block-content`)]
      return rows.some(n => n.textContent.includes('Saved when closing'))
    }, fixture.question.uuid)
    const saved = await page.evaluate(uuid => logseq.api.get_block(uuid), fixture.question.uuid)
    assert.match(saved.content, /Saved when closing/)
    await page.keyboard.press('Meta+z')
    await page.waitForFunction(async uuid =>
      (await logseq.api.get_block(uuid)).content.includes('An edited question.'), fixture.question.uuid)
    await page.keyboard.press('Meta+Shift+z')
    await page.waitForFunction(async uuid =>
      (await logseq.api.get_block(uuid)).content.includes('Saved when closing'), fixture.question.uuid)
    // Editing away an occurrence also unmounts its editor.
    await page.evaluate(async ({ source, home }) => {
      await logseq.api.update_block(source.uuid, `A self link [[${home.uuid}]].`)
    }, fixture)
    await page.waitForFunction(() => document.querySelectorAll('.ls-inline-expansion').length === 0)
    await sourceRow.locator(':scope > .block-main-container a.page-ref')
      .filter({ hasText: 'Inline expansion home' }).click()
    await sourceRow.locator('.ls-inline-expansion[data-cycle="true"]').waitFor()
    assert.equal(await sourceRow.locator('.ls-inline-expansion .ls-block').count(), 0)
    assert.deepEqual(errors, [])
    console.log(`PASS (${desktop ? 'packaged desktop' : 'browser'}): independent occurrences, native editing, shared updates, recursive expansion, ancestor cycles, native new-page autocomplete, new linked-page blocks, save-on-close, undo/redo; no runtime exceptions.`)
  } catch (error) {
    console.error(error)
    await page.screenshot({ path: '/tmp/logseq-inline-test-failure.png', fullPage: true })
    console.error(await page.locator('textarea').evaluateAll(nodes => nodes.map(n => ({
      id: n.id, className: n.className, value: n.value,
    }))))
    throw error
  } finally {
    if (desktop) {
      // Electron's inspected shutdown can wait on its daemon. This process owns
      // only the disposable test profile; no user graph is opened by the test.
      const child = browser.process()
      if (child.exitCode === null) {
        const exited = new Promise(resolve => child.once('exit', resolve))
        child.kill('SIGKILL')
        await exited
      }
    } else {
      await browser.close()
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
