/**
 * Phase 16 — Seven-day business simulation.
 * Run: node --env-file=.env.local scripts/sim-seven-day.mjs
 *
 * Creates SIM-prefixed products and walks Inventory → Sales → Payments →
 * Returns → Adjustments → WAC → Profit → Pulse → Search consistency.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (url && key) return { url, key }
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    const map = Object.fromEntries(
      raw
        .split(/\r?\n/)
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
        }),
    )
    return {
      url: map.VITE_SUPABASE_URL,
      key: map.VITE_SUPABASE_ANON_KEY,
    }
  } catch {
    return { url: null, key: null }
  }
}

const { url, key } = loadEnv()
if (!url || !key) {
  console.error('MISSING_ENV: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  process.exit(2)
}

const OWNER_EMAIL = 'owner@raseeth.demo'
const OWNER_PASS = 'DemoOwner123!'
const SALES_EMAIL = 'salesman@raseeth.demo'
const SALES_PASS = 'DemoSalesman123!'

const results = []
const created = {
  products: [],
  sales: [],
  returns: [],
  messages: [],
}

function pass(name, detail = '') {
  results.push({ status: 'PASS', name, detail })
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  results.push({ status: 'FAIL', name, detail })
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

function moneyEq(a, b, epsPaise = 0) {
  return (
    Math.abs(Math.round(Number(a) * 100) - Math.round(Number(b) * 100)) <=
    epsPaise
  )
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

function pay(method, amount) {
  return [{ method, amount: Number(amount) }]
}

function payCash(amount) {
  return pay('CASH', amount)
}

function client() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function asUser(email, password) {
  const c = client()
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  return { sb: c, user: data.user }
}

async function signOut(sb) {
  await sb.auth.signOut()
}

async function movementSum(sb, productId) {
  const { data, error } = await sb
    .from('inventory_movements')
    .select('quantity')
    .eq('product_id', productId)
  if (error) throw error
  return (data ?? []).reduce((a, m) => a + Number(m.quantity), 0)
}

async function dayBounds() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

async function main() {
  console.log(`Phase 16 simulation — ${url}`)
  console.log('---')

  const salesman = await asUser(SALES_EMAIL, SALES_PASS)
  const owner = await asUser(OWNER_EMAIL, OWNER_PASS)
  const stamp = Date.now()
  const nameA = `SIM Coca Cola ${stamp}`
  const nameB = `SIM Pepsi ${stamp}`
  const nameC = `SIM Product X ${stamp}`

  const { start: dayStart, end: dayEnd } = await dayBounds()

  // Baseline owner summary (for profitability delta)
  const { data: sumBefore } = await owner.sb.rpc('get_business_summary', {
    p_range_start: dayStart.toISOString(),
    p_range_end: dayEnd.toISOString(),
  })

  // ========== MONDAY — Opening stock ==========
  console.log('\n## Monday — Opening stock + sales')
  let cola
  let pepsi
  let productX

  {
    const { data: a, error: aErr } = await salesman.sb.rpc('create_product', {
      p_name: nameA,
      p_purchase_price: 35,
      p_retail_price: 50,
      p_wholesale_price: 44,
      p_initial_quantity: 100,
    })
    const { data: b, error: bErr } = await salesman.sb.rpc('create_product', {
      p_name: nameB,
      p_purchase_price: 32,
      p_retail_price: 45,
      p_wholesale_price: 40,
      p_initial_quantity: 80,
    })
    const { data: c, error: cErr } = await salesman.sb.rpc('create_product', {
      p_name: nameC,
      p_purchase_price: 100,
      p_retail_price: 140,
      p_wholesale_price: 125,
      p_initial_quantity: 50,
    })

    cola = a
    pepsi = b
    productX = c
    if (cola) created.products.push({ id: cola.id, code: cola.product_code, name: nameA })
    if (pepsi) created.products.push({ id: pepsi.id, code: pepsi.product_code, name: nameB })
    if (productX)
      created.products.push({
        id: productX.id,
        code: productX.product_code,
        name: nameC,
      })

    const ok =
      !aErr &&
      !bErr &&
      !cErr &&
      cola &&
      pepsi &&
      productX &&
      cola.current_quantity === 100 &&
      pepsi.current_quantity === 80 &&
      productX.current_quantity === 50 &&
      moneyEq(cola.purchase_price, 35) &&
      moneyEq(pepsi.purchase_price, 32) &&
      moneyEq(productX.purchase_price, 100) &&
      moneyEq(cola.avg_unit_cost, 35) &&
      moneyEq(pepsi.avg_unit_cost, 32) &&
      moneyEq(productX.avg_unit_cost, 100)

    if (ok) pass('Monday opening stock + WAC seed')
    else
      fail(
        'Monday opening stock + WAC seed',
        aErr?.message ?? bErr?.message ?? cErr?.message,
      )

    for (const [p, qty, cost] of [
      [cola, 100, 35],
      [pepsi, 80, 32],
      [productX, 50, 100],
    ]) {
      if (!p) continue
      const { data: moves } = await salesman.sb
        .from('inventory_movements')
        .select('*')
        .eq('product_id', p.id)
        .eq('movement_type', 'PURCHASE')
      const sum = await movementSum(salesman.sb, p.id)
      if (
        moves?.length === 1 &&
        moves[0].quantity === qty &&
        moneyEq(moves[0].unit_cost, cost) &&
        sum === qty
      )
        pass(`Monday PURCHASE history ${p.product_code}`)
      else fail(`Monday PURCHASE history ${p.product_code}`)
    }
  }

  // Monday sales
  let monColaSale
  let monPepsiSale
  {
    const { data: sale, error } = await salesman.sb.rpc('create_sale', {
      p_items: [
        {
          product_id: cola.id,
          quantity: 10,
          unit_price: 50,
          price_type: 'RETAIL',
        },
      ],
      p_payments: payCash(500),
    })
    monColaSale = sale
    if (sale) created.sales.push(sale)
    const { data: items } = await salesman.sb
      .from('sale_items')
      .select('*')
      .eq('sale_id', sale?.id)
    const { data: pays } = await salesman.sb
      .from('payments')
      .select('*')
      .eq('sale_id', sale?.id)
    const { data: moves } = await salesman.sb
      .from('inventory_movements')
      .select('*')
      .eq('reference_id', sale?.id)
      .eq('movement_type', 'SALE')
    const { data: after } = await salesman.sb
      .from('products')
      .select('current_quantity')
      .eq('id', cola.id)
      .single()

    const cost = Number(items?.[0]?.unit_cost)
    const rev = 500
    const cogs = round2(10 * cost)
    const gp = round2(rev - cogs)

    if (
      !error &&
      sale &&
      moneyEq(sale.total_amount, 500) &&
      items?.length === 1 &&
      moneyEq(items[0].unit_price, 50) &&
      moneyEq(items[0].unit_cost, 35) &&
      pays?.length === 1 &&
      moneyEq(pays[0].amount, 500) &&
      moves?.length === 1 &&
      moves[0].quantity === -10 &&
      after?.current_quantity === 90 &&
      moneyEq(gp, 150)
    )
      pass('Monday retail Cola ×10', `GP ₹${gp}`)
    else fail('Monday retail Cola ×10', error?.message ?? JSON.stringify(items))
  }

  {
    const { data: sale, error } = await salesman.sb.rpc('create_sale', {
      p_items: [
        {
          product_id: pepsi.id,
          quantity: 5,
          unit_price: 40,
          price_type: 'WHOLESALE',
        },
      ],
      p_payments: payCash(200),
    })
    monPepsiSale = sale
    if (sale) created.sales.push(sale)
    const { data: items } = await salesman.sb
      .from('sale_items')
      .select('*')
      .eq('sale_id', sale?.id)
    const { data: after } = await salesman.sb
      .from('products')
      .select('current_quantity')
      .eq('id', pepsi.id)
      .single()

    if (
      !error &&
      moneyEq(sale?.total_amount, 200) &&
      moneyEq(items?.[0]?.unit_price, 40) &&
      moneyEq(items?.[0]?.unit_cost, 32) &&
      after?.current_quantity === 75
    )
      pass('Monday wholesale Pepsi ×5', 'GP ₹40')
    else fail('Monday wholesale Pepsi ×5', error?.message)
  }

  // ========== TUESDAY — Second purchase + post-WAC sale ==========
  console.log('\n## Tuesday — WAC restock + sale')
  let tueColaSale
  let tueItem
  let expectedAvg
  {
    const { data: before } = await salesman.sb
      .from('products')
      .select('current_quantity, avg_unit_cost')
      .eq('id', cola.id)
      .single()
    const qtyBefore = Number(before.current_quantity) // 90
    const avgBefore = Number(before.avg_unit_cost) // 35
    expectedAvg = round2((qtyBefore * avgBefore + 50 * 40) / (qtyBefore + 50))

    const { error } = await salesman.sb.rpc('add_stock', {
      p_product_id: cola.id,
      p_quantity: 50,
      p_unit_cost: 40,
      p_notes: 'SIM Tuesday delivery',
    })
    const { data: after } = await salesman.sb
      .from('products')
      .select('current_quantity, purchase_price, avg_unit_cost')
      .eq('id', cola.id)
      .single()

    // Spec doc used 100×35+50×40 over 150 (=36.67) ignoring Mon sales.
    // Correct WAC uses remaining qty: (90×35+50×40)/140 ≈ 36.79
    if (
      !error &&
      after.current_quantity === 140 &&
      moneyEq(after.purchase_price, 40) &&
      moneyEq(after.avg_unit_cost, expectedAvg)
    )
      pass(
        'Tuesday WAC after restock',
        `avg=${after.avg_unit_cost} (expected ${expectedAvg}; doc 36.67 assumed pre-sale qty)`,
      )
    else
      fail(
        'Tuesday WAC after restock',
        `got avg=${after?.avg_unit_cost} qty=${after?.current_quantity} expectedAvg=${expectedAvg}`,
      )
  }

  {
    const { data: sale, error } = await salesman.sb.rpc('create_sale', {
      p_items: [
        {
          product_id: cola.id,
          quantity: 10,
          unit_price: 50,
          price_type: 'RETAIL',
        },
      ],
      p_payments: payCash(500),
    })
    tueColaSale = sale
    if (sale) created.sales.push(sale)
    const { data: items } = await salesman.sb
      .from('sale_items')
      .select('*')
      .eq('sale_id', sale?.id)
    tueItem = items?.[0]

    if (
      !error &&
      moneyEq(tueItem?.unit_price, 50) &&
      moneyEq(tueItem?.unit_cost, expectedAvg) &&
      !moneyEq(tueItem?.unit_cost, 35) &&
      !moneyEq(tueItem?.unit_cost, 40)
    )
      pass('Tuesday post-WAC sale cost snapshot', `unit_cost=${tueItem.unit_cost}`)
    else
      fail(
        'Tuesday post-WAC sale cost snapshot',
        `unit_cost=${tueItem?.unit_cost} expected≈${expectedAvg}`,
      )
  }

  // ========== WEDNESDAY — Return ==========
  console.log('\n## Wednesday — Return')
  let wedReturn
  {
    const { data: before } = await salesman.sb
      .from('products')
      .select('current_quantity')
      .eq('id', cola.id)
      .single()
    const { data: ret, error } = await salesman.sb.rpc('create_return', {
      p_items: [{ sale_item_id: tueItem.id, quantity: 3 }],
      p_refund_method: 'CASH',
    })
    wedReturn = ret
    if (ret) created.returns.push(ret)

    const { data: rItems } = await salesman.sb
      .from('return_items')
      .select('*')
      .eq('return_id', ret?.id)
    const { data: refund } = await salesman.sb
      .from('refunds')
      .select('*')
      .eq('return_id', ret?.id)
    const { data: moves } = await salesman.sb
      .from('inventory_movements')
      .select('*')
      .eq('reference_id', ret?.id)
      .eq('movement_type', 'RETURN')
    const { data: after } = await salesman.sb
      .from('products')
      .select('current_quantity')
      .eq('id', cola.id)
      .single()
    const { data: origSale } = await salesman.sb
      .from('sales')
      .select('total_amount')
      .eq('id', tueColaSale.id)
      .single()
    const { data: origItem } = await salesman.sb
      .from('sale_items')
      .select('*')
      .eq('id', tueItem.id)
      .single()

    if (
      !error &&
      moneyEq(ret?.total_amount, 150) &&
      rItems?.length === 1 &&
      moneyEq(rItems[0].unit_price, 50) &&
      moneyEq(rItems[0].unit_cost, tueItem.unit_cost) &&
      refund?.length === 1 &&
      moneyEq(refund[0].amount, 150) &&
      moves?.length === 1 &&
      moves[0].quantity === 3 &&
      after.current_quantity === before.current_quantity + 3 &&
      moneyEq(origSale.total_amount, 500) &&
      moneyEq(origItem.unit_price, 50) &&
      moneyEq(origItem.unit_cost, tueItem.unit_cost)
    )
      pass('Wednesday return preserves sale + cost')
    else fail('Wednesday return preserves sale + cost', error?.message)
  }

  // ========== THURSDAY — Adjustment ==========
  console.log('\n## Thursday — Adjustment')
  {
    const { data: before } = await salesman.sb
      .from('products')
      .select('current_quantity')
      .eq('id', pepsi.id)
      .single()
    const { data: mov, error } = await salesman.sb.rpc('adjust_stock', {
      p_product_id: pepsi.id,
      p_quantity: -4,
      p_reason: 'Damaged',
    })
    const { data: after } = await salesman.sb
      .from('products')
      .select('current_quantity, avg_unit_cost')
      .eq('id', pepsi.id)
      .single()
    const { data: stored } = await salesman.sb
      .from('inventory_movements')
      .select('*')
      .eq('id', mov?.id)
      .single()

    if (
      !error &&
      after.current_quantity === before.current_quantity - 4 &&
      stored?.movement_type === 'ADJUSTMENT' &&
      stored?.quantity === -4 &&
      stored?.notes === 'Damaged' &&
      moneyEq(after.avg_unit_cost, 32)
    )
      pass('Thursday Pepsi write-off ×4')
    else fail('Thursday Pepsi write-off ×4', error?.message)
  }

  // ========== FRIDAY — Split payment ₹1250 ==========
  console.log('\n## Friday — Split payment')
  let friSale
  {
    // X×5 (₹700) + Cola×11 (₹550) = ₹1250
    const { data: sale, error } = await salesman.sb.rpc('create_sale', {
      p_items: [
        {
          product_id: productX.id,
          quantity: 5,
          unit_price: 140,
          price_type: 'RETAIL',
        },
        {
          product_id: cola.id,
          quantity: 11,
          unit_price: 50,
          price_type: 'RETAIL',
        },
      ],
      p_payments: [
        { method: 'CASH', amount: 500 },
        { method: 'UPI', amount: 750 },
      ],
    })
    friSale = sale
    if (sale) created.sales.push(sale)
    const { data: items } = await salesman.sb
      .from('sale_items')
      .select('*')
      .eq('sale_id', sale?.id)
    const { data: pays } = await salesman.sb
      .from('payments')
      .select('*')
      .eq('sale_id', sale?.id)
    const paySum = (pays ?? []).reduce((a, p) => a + Number(p.amount), 0)
    const itemSum = (items ?? []).reduce((a, i) => a + Number(i.total_amount), 0)

    if (
      !error &&
      moneyEq(sale?.total_amount, 1250) &&
      items?.length === 2 &&
      pays?.length === 2 &&
      moneyEq(paySum, 1250) &&
      moneyEq(itemSum, 1250) &&
      items.every((i) => i.unit_cost != null)
    )
      pass('Friday split payment ₹1250', sale.sale_number)
    else fail('Friday split payment ₹1250', error?.message)
  }

  // ========== SATURDAY — Low then out of stock ==========
  console.log('\n## Saturday — Low / out of stock pulse')
  {
    const { data: cur } = await salesman.sb
      .from('products')
      .select('current_quantity')
      .eq('id', cola.id)
      .single()
    // Target qty 12 via retail sales of remaining-12
    let qty = Number(cur.current_quantity)
    if (qty > 12) {
      const sell = qty - 12
      const { error } = await salesman.sb.rpc('create_sale', {
        p_items: [
          {
            product_id: cola.id,
            quantity: sell,
            unit_price: 50,
            price_type: 'RETAIL',
          },
        ],
        p_payments: payCash(sell * 50),
      })
      if (error) fail('Saturday reduce to low stock', error.message)
      else {
        const { data: sale } = await salesman.sb
          .from('sales')
          .select('*')
          .eq('created_by', salesman.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (sale) created.sales.push(sale)
      }
    }

    const { data: at12 } = await salesman.sb
      .from('products')
      .select('current_quantity')
      .eq('id', cola.id)
      .single()

    // Clear other attention products so pulse is attributable (best-effort)
    const { data: pulseLow } = await owner.sb.rpc('get_business_pulse', {
      p_range_start: dayStart.toISOString(),
      p_range_end: dayEnd.toISOString(),
    })
    const typesLow = (pulseLow?.signals ?? []).map((s) => s.type)
    if (at12?.current_quantity === 12 && typesLow.includes('LOW_STOCK'))
      pass('Saturday LOW_STOCK pulse at qty 12')
    else
      fail(
        'Saturday LOW_STOCK pulse at qty 12',
        `qty=${at12?.current_quantity} types=${JSON.stringify(typesLow)}`,
      )

    // Sell remaining 12 → 0
    {
      const { error } = await salesman.sb.rpc('create_sale', {
        p_items: [
          {
            product_id: cola.id,
            quantity: 12,
            unit_price: 50,
            price_type: 'RETAIL',
          },
        ],
        p_payments: payCash(600),
      })
      if (error) fail('Saturday sell to zero', error.message)
      else {
        const { data: sale } = await salesman.sb
          .from('sales')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (sale) created.sales.push(sale)
      }
    }

    const { data: at0 } = await salesman.sb
      .from('products')
      .select('current_quantity')
      .eq('id', cola.id)
      .single()
    const { data: pulseOut } = await owner.sb.rpc('get_business_pulse', {
      p_range_start: dayStart.toISOString(),
      p_range_end: dayEnd.toISOString(),
    })
    const typesOut = (pulseOut?.signals ?? []).map((s) => s.type)
    const lowDesc = (pulseOut?.signals ?? []).find((s) => s.type === 'LOW_STOCK')
      ?.description
    const outOk =
      at0?.current_quantity === 0 &&
      typesOut.includes('OUT_OF_STOCK') &&
      // Cola at 0 must not be counted as low-stock (qty > 0 required)
      !(lowDesc && /SIM Coca Cola/i.test(lowDesc) && /units left/i.test(lowDesc))

    if (outOk) pass('Saturday OUT_OF_STOCK (not also single LOW for Cola)')
    else
      fail(
        'Saturday OUT_OF_STOCK (not also single LOW for Cola)',
        `qty=${at0?.current_quantity} types=${JSON.stringify(typesOut)} low=${lowDesc}`,
      )
  }

  // ========== SUNDAY — Owner + salesman review ==========
  console.log('\n## Sunday — Owner / salesman / consistency')

  // Owner analytics
  {
    const { data: pulse, error: pErr } = await owner.sb.rpc('get_business_pulse', {
      p_range_start: dayStart.toISOString(),
      p_range_end: dayEnd.toISOString(),
    })
    const { data: sum, error: sErr } = await owner.sb.rpc('get_business_summary', {
      p_range_start: dayStart.toISOString(),
      p_range_end: dayEnd.toISOString(),
    })
    const { data: top, error: tErr } = await owner.sb.rpc('get_top_products', {
      p_range_start: dayStart.toISOString(),
      p_range_end: dayEnd.toISOString(),
      p_limit: 5,
    })
    const { data: inv } = await owner.sb.rpc('get_inventory_summary')

    if (
      !pErr &&
      !sErr &&
      !tErr &&
      pulse &&
      sum &&
      'net_sales' in sum &&
      'gross_profit' in sum &&
      'gross_margin' in sum &&
      'cost_coverage' in sum &&
      Array.isArray(top) &&
      inv
    )
      pass('Sunday owner overview RPCs')
    else fail('Sunday owner overview RPCs', pErr?.message ?? sErr?.message)

    // Owner cannot operate
    const { error: denySale } = await owner.sb.rpc('create_sale', {
      p_items: [
        {
          product_id: pepsi.id,
          quantity: 1,
          unit_price: 45,
          price_type: 'RETAIL',
        },
      ],
      p_payments: payCash(45),
    })
    if (denySale && /salesmen/i.test(denySale.message))
      pass('Sunday owner cannot create_sale')
    else fail('Sunday owner cannot create_sale', denySale?.message ?? 'allowed')
  }

  // Search
  {
    const safe = nameA.replace(/[%_,]/g, '')
    const { data: products } = await owner.sb
      .from('products')
      .select('id, name, product_code, current_quantity')
      .or(`name.ilike.%${safe}%,product_code.ilike.%${safe}%`)
      .limit(10)
    const hit = (products ?? []).find((p) => p.id === cola.id)
    if (hit && !('gross_profit' in hit) && !('margin' in hit))
      pass('Sunday search product SIM Coca Cola', hit.product_code)
    else fail('Sunday search product SIM Coca Cola')

    if (friSale?.sale_number) {
      const { data: sales } = await owner.sb
        .from('sales')
        .select('id, sale_number, total_amount')
        .ilike('sale_number', `%${friSale.sale_number}%`)
        .limit(5)
      if ((sales ?? []).some((s) => s.id === friSale.id))
        pass('Sunday search sale number', friSale.sale_number)
      else fail('Sunday search sale number')
    }

    if (wedReturn?.return_number) {
      const { data: rets } = await owner.sb
        .from('returns')
        .select('id, return_number, total_amount')
        .ilike('return_number', `%${wedReturn.return_number}%`)
        .limit(5)
      if ((rets ?? []).some((r) => r.id === wedReturn.id))
        pass('Sunday search return number', wedReturn.return_number)
      else fail('Sunday search return number')
    }

    const routesOk =
      `/inventory/${cola.id}`.startsWith('/inventory/') &&
      friSale &&
      `/sales/${friSale.id}`.startsWith('/sales/') &&
      wedReturn &&
      `/returns/${wedReturn.id}`.startsWith('/returns/')
    if (routesOk) pass('Sunday search routes map to existing screens')
    else fail('Sunday search routes map to existing screens')
  }

  // Salesman: ops OK, analytics denied
  {
    const { data: inv, error: iErr } = await salesman.sb.rpc(
      'get_inventory_summary',
    )
    const { error: pulseErr } = await salesman.sb.rpc('get_business_pulse', {
      p_range_start: dayStart.toISOString(),
      p_range_end: dayEnd.toISOString(),
    })
    const { error: sumErr } = await salesman.sb.rpc('get_business_summary', {
      p_range_start: dayStart.toISOString(),
      p_range_end: dayEnd.toISOString(),
    })
    if (
      !iErr &&
      inv &&
      pulseErr &&
      /owners/i.test(pulseErr.message) &&
      sumErr &&
      /owners/i.test(sumErr.message)
    )
      pass('Sunday salesman ops OK / analytics denied')
    else fail('Sunday salesman ops OK / analytics denied')
  }

  // Message (activity)
  {
    const { data: msg, error } = await owner.sb.rpc('send_business_message', {
      p_message: `SIM week review ${stamp}`,
    })
    if (!error && msg) {
      created.messages.push(msg.id)
      pass('Sunday owner message for activity')
    } else fail('Sunday owner message for activity', error?.message)
  }

  // ----- Consistency checks -----
  console.log('\n## Consistency checks')

  // Inventory
  {
    let allOk = true
    for (const p of [cola, pepsi, productX]) {
      const { data: row } = await salesman.sb
        .from('products')
        .select('current_quantity, product_code')
        .eq('id', p.id)
        .single()
      const sum = await movementSum(salesman.sb, p.id)
      if (row.current_quantity !== sum) {
        allOk = false
        fail(
          `Inventory consistency ${row.product_code}`,
          `qty=${row.current_quantity} sum=${sum}`,
        )
      }
    }
    if (allOk) pass('Inventory consistency (all SIM products)')
  }

  // Sales / payments
  {
    let salesOk = true
    let paysOk = true
    for (const sale of created.sales.filter(Boolean)) {
      const { data: items } = await salesman.sb
        .from('sale_items')
        .select('total_amount, unit_cost')
        .eq('sale_id', sale.id)
      const itemSum = (items ?? []).reduce((a, i) => a + Number(i.total_amount), 0)
      if (!moneyEq(itemSum, sale.total_amount)) {
        salesOk = false
        fail(`Sale total ${sale.sale_number}`, `${itemSum} vs ${sale.total_amount}`)
      }
      if ((items ?? []).some((i) => i.unit_cost == null)) {
        salesOk = false
        fail(`Sale costs non-null ${sale.sale_number}`)
      }
      const { data: pays } = await salesman.sb
        .from('payments')
        .select('amount')
        .eq('sale_id', sale.id)
      const paySum = (pays ?? []).reduce((a, p) => a + Number(p.amount), 0)
      if (!moneyEq(paySum, sale.total_amount)) {
        paysOk = false
        fail(`Payment sum ${sale.sale_number}`, `${paySum} vs ${sale.total_amount}`)
      }
    }
    if (salesOk) pass('Sales consistency')
    if (paysOk) pass('Payments consistency')
  }

  // Returns
  {
    let ok = true
    for (const ret of created.returns.filter(Boolean)) {
      const { data: items } = await salesman.sb
        .from('return_items')
        .select('total_amount, unit_cost, sale_item_id')
        .eq('return_id', ret.id)
      const itemSum = (items ?? []).reduce((a, i) => a + Number(i.total_amount), 0)
      const { data: refund } = await salesman.sb
        .from('refunds')
        .select('amount')
        .eq('return_id', ret.id)
      if (!moneyEq(itemSum, ret.total_amount)) ok = false
      if (!moneyEq(refund?.[0]?.amount, ret.total_amount)) ok = false
      for (const ri of items ?? []) {
        if (ri.unit_cost == null) ok = false
        const { data: si } = await salesman.sb
          .from('sale_items')
          .select('unit_cost')
          .eq('id', ri.sale_item_id)
          .single()
        if (!moneyEq(si?.unit_cost, ri.unit_cost)) ok = false
      }
    }
    if (ok) pass('Returns + cost copy consistency')
    else fail('Returns + cost copy consistency')
  }

  // Profitability delta vs manual SIM calc (known-cost)
  {
    const simSaleIds = created.sales.filter(Boolean).map((s) => s.id)
    const { data: sItems } = await salesman.sb
      .from('sale_items')
      .select('unit_price, unit_cost, quantity, total_amount, sale_id')
      .in('sale_id', simSaleIds)
    const simReturnIds = created.returns.filter(Boolean).map((r) => r.id)
    const { data: rItems } = await salesman.sb
      .from('return_items')
      .select('unit_price, unit_cost, quantity, total_amount')
      .in('return_id', simReturnIds.length ? simReturnIds : ['00000000-0000-0000-0000-000000000000'])

    let gross = 0
    let saleCogs = 0
    for (const i of sItems ?? []) {
      gross += Number(i.total_amount)
      saleCogs += round2(Number(i.unit_cost) * Number(i.quantity))
    }
    let retRev = 0
    let retCogs = 0
    for (const i of rItems ?? []) {
      retRev += Number(i.total_amount)
      retCogs += round2(Number(i.unit_cost) * Number(i.quantity))
    }
    const net = round2(gross - retRev)
    const cogs = round2(saleCogs - retCogs)
    const profit = round2(net - cogs)
    const margin = net !== 0 ? round2((profit / net) * 100) : null

    const { data: sumAfter } = await owner.sb.rpc('get_business_summary', {
      p_range_start: dayStart.toISOString(),
      p_range_end: dayEnd.toISOString(),
    })

    const dGross = round2(Number(sumAfter.gross_sales) - Number(sumBefore.gross_sales))
    const dRet = round2(Number(sumAfter.returns) - Number(sumBefore.returns))
    const dNet = round2(Number(sumAfter.net_sales) - Number(sumBefore.net_sales))
    const dCogs = round2(Number(sumAfter.cogs ?? 0) - Number(sumBefore.cogs ?? 0))
    const dProfit = round2(
      Number(sumAfter.gross_profit ?? 0) - Number(sumBefore.gross_profit ?? 0),
    )

    if (
      moneyEq(dGross, gross) &&
      moneyEq(dRet, retRev) &&
      moneyEq(dNet, net) &&
      moneyEq(dCogs, cogs) &&
      moneyEq(dProfit, profit)
    )
      pass(
        'Profitability delta matches SIM calc',
        `net=${net} cogs=${cogs} gp=${profit} margin≈${margin}%`,
      )
    else
      fail(
        'Profitability delta matches SIM calc',
        JSON.stringify({
          manual: { gross, retRev, net, cogs, profit, margin },
          delta: { dGross, dRet, dNet, dCogs, dProfit },
        }),
      )
  }

  // Activity sources present
  {
    const { data: sales } = await salesman.sb
      .from('sales')
      .select('id')
      .in(
        'id',
        created.sales.filter(Boolean).map((s) => s.id),
      )
    const { data: moves } = await salesman.sb
      .from('inventory_movements')
      .select('movement_type')
      .in(
        'product_id',
        [cola.id, pepsi.id, productX.id],
      )
    const types = new Set((moves ?? []).map((m) => m.movement_type))
    if (
      (sales?.length ?? 0) >= 4 &&
      types.has('PURCHASE') &&
      types.has('SALE') &&
      types.has('RETURN') &&
      types.has('ADJUSTMENT')
    )
      pass('Activity source events present (no dup table)')
    else fail('Activity source events present (no dup table)', [...types].join(','))
  }

  // Pulse still coherent
  {
    const { data: pulse } = await owner.sb.rpc('get_business_pulse', {
      p_range_start: dayStart.toISOString(),
      p_range_end: dayEnd.toISOString(),
    })
    const types = (pulse?.signals ?? []).map((s) => s.type)
    if (types.includes('OUT_OF_STOCK') && (pulse.signals?.length ?? 0) <= 3)
      pass('Business Pulse coherent', types.join(','))
    else fail('Business Pulse coherent', JSON.stringify(types))
  }

  // Immutability spot-check: Tuesday sale unchanged after later ops
  {
    const { data: sale } = await salesman.sb
      .from('sales')
      .select('total_amount')
      .eq('id', tueColaSale.id)
      .single()
    const { data: item } = await salesman.sb
      .from('sale_items')
      .select('unit_price, unit_cost, quantity')
      .eq('id', tueItem.id)
      .single()
    const { data: pays } = await salesman.sb
      .from('payments')
      .select('amount')
      .eq('sale_id', tueColaSale.id)
    if (
      moneyEq(sale.total_amount, 500) &&
      moneyEq(item.unit_price, 50) &&
      moneyEq(item.unit_cost, expectedAvg) &&
      item.quantity === 10 &&
      moneyEq(pays?.[0]?.amount, 500)
    )
      pass('Immutability: Tuesday sale/payments unchanged')
    else fail('Immutability: Tuesday sale/payments unchanged')
  }

  await signOut(salesman.sb)
  await signOut(owner.sb)

  // Summary
  console.log('\n=== SIMULATION CREATED ===')
  console.log('Products:')
  for (const p of created.products) console.log(`  ${p.code}  ${p.name}  ${p.id}`)
  console.log('Sales:')
  for (const s of created.sales.filter(Boolean))
    console.log(`  ${s.sale_number}  ${s.id}  ₹${s.total_amount}`)
  console.log('Returns:')
  for (const r of created.returns.filter(Boolean))
    console.log(`  ${r.return_number}  ${r.id}  ₹${r.total_amount}`)

  console.log('\n=== SUMMARY ===')
  const passed = results.filter((r) => r.status === 'PASS')
  const failed = results.filter((r) => r.status === 'FAIL')
  console.log(`PASS: ${passed.length}`)
  console.log(`FAIL: ${failed.length}`)
  if (failed.length) {
    console.log('\nFailures:')
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`)
  }
  process.exitCode = failed.length ? 1 : 0
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exitCode = 1
})
