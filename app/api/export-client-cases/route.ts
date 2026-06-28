import { NextResponse } from 'next/server';
import { getCurrentUser, getClient, getCases } from '@/lib/supabase/queries';
import fs from 'fs';
import path from 'path';

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');
    const locale = searchParams.get('locale') || 'en';

    if (!clientId) {
      return new NextResponse('Missing client_id', { status: 400 });
    }
    if (!['en', 'ar'].includes(locale)) {
      return new NextResponse('Invalid locale', { status: 400 });
    }

    const messagesPath = path.join(process.cwd(), 'messages', `${locale}.json`);
    const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
    const t = (key: string): string => {
      const parts = key.split('.');
      let val: unknown = messages;
      for (const part of parts) {
        if (val && typeof val === 'object' && val !== null) {
          val = (val as Record<string, unknown>)[part];
        } else {
          val = undefined;
        }
      }
      return (val as string) || key;
    };

    const escapeHtml = (s: string): string =>
      s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;') : '';

    const client = await getClient(clientId);
    const cases = await getCases(clientId);

    if (cases.length === 0) {
      return new NextResponse(JSON.stringify({ error: 'NO_DATA' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const isSuperAdmin = user.role === 'superadmin';
    const isRtl = locale === 'ar';
    const reportTitle = `${client.name} — ${t('Cases.title') || 'Cases'}`;

    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    const logoSrc = fs.existsSync(logoPath)
      ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
      : '';

    const exportedAt = `${user.full_name} · ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

    let balance = 0;
    let displayPayments = 0;
    const displayExpenses = client.total_expenses;

    // For per_case clients, total_profit is in cases.profit_amount; for monthly it's in profit transactions
    const totalProfit = client.profit_type === 'per_case'
      ? cases.reduce((sum, c) => sum + (Number(c.profit_amount) || 0), 0)
      : client.total_profit;

    if (isSuperAdmin) {
      displayPayments = client.total_payments;
      balance = displayPayments - displayExpenses;
    } else {
      displayPayments = user.cash_advance || 0;
      balance = displayPayments - displayExpenses;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${locale}" dir="${isRtl ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="UTF-8">
        <title>${reportTitle}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --primary: #f54e00;
            --ink-900: #26251e;
            --ink-700: #3b3a34;
            --ink-500: #807d72;
            --ink-100: #e6e5e0;
            --bg: #ffffff;
            --card-bg: #fafaf7;
          }
          body { 
            font-family: ${isRtl ? "'Cairo', sans-serif" : "'Inter', sans-serif"};
            color: var(--ink-900);
            margin: 0;
            padding: 40px;
            line-height: 1.5;
            background: var(--bg);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 36px;
            border-bottom: 1px solid var(--ink-100);
            padding-bottom: 20px;
          }
          .brand-area {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .brand-logo img {
            width: 40px;
            height: 40px;
            border-radius: 8px;
            display: block;
          }
          .brand-text .brand-name {
            font-weight: 700;
            font-size: 15px;
            color: var(--primary);
            line-height: 1.2;
          }
          .brand-text .brand-sub {
            font-size: 11px;
            color: var(--ink-500);
            margin-top: 1px;
          }
          .title-area {
            text-align: ${isRtl ? 'left' : 'right'};
          }
          .title-area h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: var(--ink-900);
            letter-spacing: -0.02em;
          }
          .meta {
            font-size: 11px;
            color: var(--ink-500);
            margin-top: 4px;
          }
          .summary-strip {
            display: flex;
            background: var(--card-bg);
            border: 1px solid var(--ink-100);
            border-radius: 12px;
            padding: 24px 12px;
            margin-bottom: 40px;
          }
          .summary-item {
            flex: 1;
            text-align: center;
            border-inline-end: 1px solid var(--ink-200);
            padding: 0 10px;
          }
          .summary-item:last-child {
            border-inline-end: none;
          }
          .summary-label {
            font-size: 11px;
            text-transform: uppercase;
            color: var(--ink-500);
            font-weight: 400;
            margin-bottom: 8px;
            letter-spacing: 0.05em;
          }
          .summary-value {
            font-size: 16px;
            font-weight: 400;
            color: var(--ink-900);
            white-space: nowrap;
          }
          .summary-value.income { color: #059669; }
          .summary-value.expense { color: #dc2626; }
          .summary-value.balance-positive { color: var(--ink-900); }
          .summary-value.balance-negative { color: var(--ink-900); }
          
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px;
          }
          th { 
            background-color: var(--card-bg); 
            color: var(--ink-700);
            font-weight: 700;
            text-transform: uppercase;
            font-size: 11px;
            padding: 14px 12px;
            text-align: ${isRtl ? 'right' : 'left'};
            border-bottom: 2px solid var(--ink-100);
            letter-spacing: 0.05em;
            white-space: nowrap;
          }
          td { 
            padding: 14px 12px; 
            border-bottom: 1px solid var(--ink-100);
            color: var(--ink-700);
            font-size: 13px;
          }
          .amount-cell {
            text-align: ${isRtl ? 'left' : 'right'};
            font-weight: 600;
            font-family: ${isRtl ? "'Cairo', sans-serif" : "'Inter', sans-serif"};
            white-space: nowrap;
          }
          .payment { color: #059669; }
          .expense { color: #dc2626; }
          .profit { color: #1d4ed8; }
          .status-badge {
            display: inline-flex;
            align-items: center;
            border-radius: 9999px;
            padding: 2px 8px;
            font-size: 11px;
            font-weight: 600;
          }
          .status-open { background: #dcfce7; color: #166534; }
          .status-closed { background: #f3f4f6; color: #374151; }
          
          .footer {
            position: fixed;
            bottom: 0;
            left: 40px;
            right: 40px;
            padding: 12px 0;
            border-top: 1px solid var(--ink-100);
            text-align: center;
            font-size: 11px;
            color: var(--ink-500);
            background: var(--bg);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand-area">
            <div class="brand-logo">${logoSrc ? `<img src="${logoSrc}" />` : ''}</div>
            <div class="brand-text">
              <div class="brand-name">${t('Sidebar.appName')}</div>
              <div class="brand-sub">${t('Sidebar.subtitle')}</div>
            </div>
          </div>
          <div class="title-area">
            <h1>${reportTitle}</h1>
            <div class="meta"><span dir="ltr">${exportedAt}</span></div>
          </div>
        </div>
        
        <div class="summary-strip">
          ${isSuperAdmin ? `
          <div class="summary-item">
            <div class="summary-label">${t('ClientDetails.totalPayments') || 'Total Payments'}</div>
            <div class="summary-value income">+${displayPayments.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${locale === 'ar' ? 'إجمالي الاتعاب' : 'Total Profit'}</div>
            <div class="summary-value profit">+${totalProfit.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
          ` : ''}
          <div class="summary-item">
            <div class="summary-label">${isSuperAdmin ? t('Dashboard.totalExpenses') : (t('Common.myExpenses') || 'My Expenses')}</div>
            <div class="summary-value expense">-${displayExpenses.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${t('Dashboard.totalBalance')}</div>
            <div class="summary-value ${balance >= 0 ? 'balance-positive' : 'balance-negative'}">${balance.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
          ${isSuperAdmin ? `
          <div class="summary-item">
            <div class="summary-label">${locale === 'ar' ? 'صافي الحساب' : 'Net Balance'}</div>
            <div class="summary-value ${(balance - totalProfit) >= 0 ? 'balance-positive' : 'balance-negative'}">${(balance - totalProfit).toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
          ` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>${t('Cases.columns.title') || 'Title'}</th>
              <th>${t('Cases.columns.status') || 'Status'}</th>
              ${isSuperAdmin && client.profit_type === 'per_case' ? `<th class="amount-cell">${t('Cases.columns.profit') || 'Profit'}</th>` : ''}
              ${isSuperAdmin ? `<th class="amount-cell">${t('Cases.columns.payments') || 'Payments'}</th>` : ''}
              <th class="amount-cell">${t('Cases.columns.expenses') || 'Expenses'}</th>
              ${isSuperAdmin ? `<th class="amount-cell">${t('Cases.columns.balance') || 'Balance'}</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${cases.map((c, index) => `
              <tr>
                <td style="text-align: center; color: var(--ink-500); font-size: 12px;">${index + 1}</td>
                <td>${escapeHtml(c.title)}</td>
                <td><span class="status-badge ${c.status === 'open' ? 'status-open' : 'status-closed'}">${t('Cases.status.' + c.status)}</span></td>
                ${isSuperAdmin && client.profit_type === 'per_case' ? `<td class="amount-cell profit">${c.profit_amount ? '+' + c.profit_amount.toLocaleString(locale, { style: 'currency', currency: 'EGP' }) : '—'}</td>` : ''}
                ${isSuperAdmin ? `<td class="amount-cell payment">${c.total_payments > 0 ? '+' : ''}${c.total_payments.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</td>` : ''}
                <td class="amount-cell expense">${c.total_expenses > 0 ? '-' : ''}${c.total_expenses.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</td>
                ${isSuperAdmin ? `<td class="amount-cell">${c.balance.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          ${t('Sidebar.appName')} © ${new Date().getFullYear()} · ${t('Sidebar.subtitle')}
        </div>
      </body>
      </html>
    `;

    // Puppeteer launch options
    let browser;
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      const chromium = (await import('@sparticuz/chromium-min')).default;
      const puppeteer = (await import('puppeteer-core')).default;

      const CHROMIUM_PACK_URL = 'https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar';

      let executablePath;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        executablePath = await (chromium as any).executablePath(CHROMIUM_PACK_URL);
      } catch (pathError) {
        console.error('Failed to get executable path:', pathError);
        throw new Error('Chromium binary path error: ' + (pathError as Error).message);
      }

      browser = await puppeteer.launch({
        args: [...chromium.args, '--font-render-hinting=none'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        defaultViewport: (chromium as any).defaultViewport,
        executablePath,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        headless: (chromium as any).headless,
      });
    } else {
      const localPuppeteer = (await import('puppeteer')).default;
      browser = await localPuppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
      });
    }

    const page = await browser.newPage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' as any });

    await page.evaluateHandle('document.fonts.ready');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '60px', left: '20px' }
    });

    await browser.close();

    const generatedFilename = locale === 'ar' ? `تقرير_مهام_عميل_${client.name}.pdf` : `client_${client.name}_cases_report.pdf`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent(generatedFilename)}`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return new NextResponse('Internal server error: ' + msg, { status: 500 });
  }
}
