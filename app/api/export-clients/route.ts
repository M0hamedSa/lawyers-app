import { NextResponse } from 'next/server';
import { getCurrentUser, getClients } from '@/lib/supabase/queries';
import { createClient } from '@/lib/supabase/server';
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
    const locale = searchParams.get('locale') || 'en';
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
      s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;') : '';

    const clients = await getClients();

    if (clients.length === 0) {
      return new NextResponse(JSON.stringify({ error: 'NO_DATA' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const isSuperAdmin = user.role === 'superadmin';
    const isRtl = locale === 'ar';
    const reportTitle = t('Clients.heading') || 'Clients';

    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    const logoSrc = fs.existsSync(logoPath)
      ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
      : '';

    const exportedAt = `${user.full_name} · ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

    // For per_case clients, we need to sum profit_amount from cases
    const supabase = await createClient();
    const { data: allCases } = await supabase.from('cases').select('client_id, profit_amount');

    const casesProfitByClient: Record<string, number> = {};
    (allCases || []).forEach(c => {
      casesProfitByClient[c.client_id] = (casesProfitByClient[c.client_id] || 0) + (Number(c.profit_amount) || 0);
    });

    const totalPayments = clients.reduce((sum, c) => sum + c.total_payments, 0);
    const totalExpenses = clients.reduce((sum, c) => sum + c.total_expenses, 0);
    const totalProfit = clients.reduce((sum, c) => {
      if (c.profit_type === 'per_case') {
        return sum + (casesProfitByClient[c.id] || 0);
      }
      return sum + c.total_profit;
    }, 0);
    const totalBalance = totalPayments - totalExpenses;

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
          .brand-area { display: flex; align-items: center; gap: 10px; }
          .brand-logo img { width: 40px; height: 40px; border-radius: 8px; display: block; }
          .brand-text .brand-name { font-weight: 700; font-size: 15px; color: var(--primary); line-height: 1.2; }
          .brand-text .brand-sub { font-size: 11px; color: var(--ink-500); margin-top: 1px; }
          .title-area { text-align: ${isRtl ? 'left' : 'right'}; }
          .title-area h1 { margin: 0; font-size: 18px; font-weight: 700; color: var(--ink-900); letter-spacing: -0.02em; }
          .meta { font-size: 11px; color: var(--ink-500); margin-top: 4px; }

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
            border-inline-end: 1px solid var(--ink-100);
            padding: 0 10px;
          }
          .summary-item:last-child { border-inline-end: none; }
          .summary-label { font-size: 11px; text-transform: uppercase; color: var(--ink-500); font-weight: 400; margin-bottom: 8px; letter-spacing: 0.05em; }
          .summary-value { font-size: 16px; font-weight: 400; color: var(--ink-900); white-space: nowrap; }
          .summary-value.income { color: #059669; }
          .summary-value.expense { color: #dc2626; }
          .summary-value.profit { color: #1d4ed8; }

          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
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
          td { padding: 14px 12px; border-bottom: 1px solid var(--ink-100); color: var(--ink-700); font-size: 13px; }
          .amount-cell {
            text-align: ${isRtl ? 'left' : 'right'};
            font-weight: 600;
            white-space: nowrap;
          }
          .payment { color: #059669; }
          .expense-color { color: #dc2626; }
          .profit-color { color: #1d4ed8; }
          .badge {
            display: inline-flex;
            align-items: center;
            border-radius: 9999px;
            padding: 2px 8px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin-inline-end: 4px;
          }
          .badge-active { background: #dcfce7; color: #166534; }
          .badge-inactive { background: #f3f4f6; color: #374151; }
          .badge-monthly { background: #f3e8ff; color: #7c3aed; }
          .badge-percase { background: #e0f2fe; color: #0369a1; }

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
          <div class="summary-item">
            <div class="summary-label">${locale === 'ar' ? 'إجمالي العملاء' : 'Total Clients'}</div>
            <div class="summary-value">${clients.length}</div>
          </div>
          ${isSuperAdmin ? `
          <div class="summary-item">
            <div class="summary-label">${t('Dashboard.totalPayments') || 'Total Payments'}</div>
            <div class="summary-value income">+${totalPayments.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${locale === 'ar' ? 'إجمالي الاتعاب' : 'Total Profit'}</div>
            <div class="summary-value profit">+${totalProfit.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${t('Dashboard.totalExpenses') || 'Total Expenses'}</div>
            <div class="summary-value expense">-${totalExpenses.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${t('Dashboard.totalBalance') || 'Balance'}</div>
            <div class="summary-value">${totalBalance.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
          ` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>${t('Clients.columns.client') || 'Client'}</th>
              <th>${t('Clients.columns.contact') || 'Contact'}</th>
              ${isSuperAdmin ? `
              <th class="amount-cell">${t('Clients.columns.payments') || 'Payments'}</th>
              <th class="amount-cell">${locale === 'ar' ? 'الاتعاب' : 'Profit'}</th>
              <th class="amount-cell">${t('Clients.columns.expenses') || 'Expenses'}</th>
              <th class="amount-cell">${t('Clients.columns.balance') || 'Balance'}</th>
              ` : `
              <th class="amount-cell">${locale === 'ar' ? 'مصروفاتي' : 'My Expenses'}</th>
              `}
            </tr>
          </thead>
          <tbody>
            ${clients.map((client, index) => {
              const clientProfit = client.profit_type === 'per_case'
                ? (casesProfitByClient[client.id] || 0)
                : client.total_profit;
              return `
              <tr>
                <td style="text-align: center; color: var(--ink-500); font-size: 12px;">${index + 1}</td>
                <td>
                  <div style="font-weight: 600; color: var(--ink-900);">${escapeHtml(client.name)}</div>
                  <div style="margin-top: 4px;">
                    <span class="badge ${client.status === 'active' ? 'badge-active' : 'badge-inactive'}">${client.status === 'active' ? t('Clients.form.active') : t('Clients.form.inactive')}</span>
                    ${isSuperAdmin ? `<span class="badge ${client.profit_type === 'monthly' ? 'badge-monthly' : 'badge-percase'}">${client.profit_type === 'monthly' ? t('Clients.form.monthly') : t('Clients.form.perCase')}</span>` : ''}
                  </div>
                </td>
                <td style="color: var(--ink-500);">
                  <div>${escapeHtml(client.phone || (locale === 'ar' ? 'لا يوجد' : 'N/A'))}</div>
                  <div>${escapeHtml(client.email || (locale === 'ar' ? 'لا يوجد' : 'N/A'))}</div>
                </td>
                ${isSuperAdmin ? `
                <td class="amount-cell payment">+${client.total_payments.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</td>
                <td class="amount-cell profit-color">+${clientProfit.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</td>
                <td class="amount-cell expense-color">-${client.total_expenses.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</td>
                <td class="amount-cell">${client.balance.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</td>
                ` : `
                <td class="amount-cell expense-color">-${client.total_expenses.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</td>
                `}
              </tr>
            `}).join('')}
          </tbody>
        </table>

        <div class="footer">
          ${t('Sidebar.appName')} © ${new Date().getFullYear()} · ${t('Sidebar.subtitle')}
        </div>
      </body>
      </html>
    `;

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

    const todayStr = new Date().toISOString().split('T')[0];
    const filename = locale === 'ar' ? `تقرير_قائمة_العملاء_${todayStr}.pdf` : `clients_list_report_${todayStr}.pdf`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error('Error generating clients PDF:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return new NextResponse('Internal server error: ' + msg, { status: 500 });
  }
}
