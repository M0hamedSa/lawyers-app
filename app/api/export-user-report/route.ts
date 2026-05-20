import { NextResponse } from 'next/server';
import { getCurrentUser, getDashboardData } from '@/lib/supabase/queries';
import { createClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';

export const maxDuration = 60; // Allow up to 60 seconds for PDF generation

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') || 'en';

    // Load translations
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

    // Retrieve active dashboard data (scoped securely to current user via session)
    const data = await getDashboardData();

    // Query detailed expense transactions securely
    const supabase = await createClient();
    let txQuery = supabase
      .from("transactions")
      .select("*, clients(name), users!transactions_created_by_fkey(full_name)")
      .eq("type", "expense")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (user.role !== "superadmin") {
      txQuery = txQuery.eq("created_by", user.id);
    }

    const { data: detailedExpenses, error: txError } = await txQuery;
    if (txError) throw new Error(txError.message);

    const isRtl = locale === 'ar';
    const isSuperAdmin = data.userRole === 'superadmin';

    const reportTitle = isSuperAdmin
      ? (t('Admin.firmReportTitle') || 'Firm Dashboard Summary Report')
      : (t('Admin.myReportTitle') || 'My Dashboard Summary Report');

    const labelPayments = isSuperAdmin
      ? (t('Dashboard.totalPayments') || 'Total Payments')
      : (t('Common.cashAdvance') || 'Cash Advance');

    const labelExpenses = isSuperAdmin
      ? (t('Dashboard.totalExpenses') || 'Total Expenses')
      : (t('Common.myExpenses') || 'My Expenses');

    const labelClients = t('Dashboard.totalClients') || 'Total Clients';
    const labelBalance = t('Dashboard.totalBalance') || 'Total Balance';

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
            --primary: #c29d5b;
            --ink-900: #111827;
            --ink-700: #374151;
            --ink-500: #6b7280;
            --ink-100: #e5e7eb;
            --bg: #ffffff;
            --card-bg: #f9fafb;
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
            align-items: flex-start;
            margin-bottom: 40px;
            border-bottom: 2px solid var(--ink-100);
            padding-bottom: 20px;
          }
          .title-area h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: 700;
            color: var(--ink-900);
          }
          .meta { 
            color: var(--ink-500); 
            font-size: 14px; 
            margin-top: 5px;
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
          .summary-value.balance-positive { color: #059669; }
          .summary-value.balance-negative { color: #dc2626; }
          
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
          .numeric-cell {
            text-align: ${isRtl ? 'left' : 'right'};
            font-weight: 600;
            font-family: ${isRtl ? "'Cairo', sans-serif" : "'Inter', sans-serif"};
            white-space: nowrap;
          }
          .negative { color: #dc2626; }
          .positive { color: #059669; }
          
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid var(--ink-100);
            text-align: center;
            font-size: 11px;
            color: var(--ink-500);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h1>${reportTitle}</h1>
            <div class="meta">${t('Sidebar.subtitle')} · ${new Date().toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short' })}</div>
          </div>
          <div style="text-align: ${isRtl ? 'left' : 'right'}">
            <div style="font-weight: 700; color: var(--primary); font-size: 18px;">${t('Sidebar.appName')}</div>
            <div style="font-size: 12px; color: var(--ink-500);">${user.full_name} (${data.userRole || ''})</div>
          </div>
        </div>
        
        <div class="summary-strip">
          <div class="summary-item">
            <div class="summary-label">${labelClients}</div>
            <div class="summary-value">${data.totalClients}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${labelPayments}</div>
            <div class="summary-value income">+${data.totalPayments.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${labelExpenses}</div>
            <div class="summary-value expense">-${data.totalExpenses.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${labelBalance}</div>
            <div class="summary-value ${data.totalBalance >= 0 ? 'balance-positive' : 'balance-negative'}">${data.totalBalance.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
        </div>

        <h3 style="margin-top: 40px; font-size: 16px; border-bottom: 1px solid var(--ink-100); padding-bottom: 8px;">
          ${t('Common.detailedExpenses') || 'Detailed Expense Transactions'}
        </h3>

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>${t('Transaction.columns.date') || 'Date'}</th>
              <th>${t('Clients.columns.client') || 'Client'}</th>
              ${isSuperAdmin ? `<th>${t('Common.by') || 'By'}</th>` : ''}
              <th>${t('Transaction.columns.description') || 'Description'}</th>
              <th style="text-align: ${isRtl ? 'left' : 'right'}">${t('Transaction.columns.amount') || 'Amount'}</th>
            </tr>
          </thead>
          <tbody>
            ${(detailedExpenses || []).map((tx, index) => `
              <tr>
                <td style="text-align: center; color: var(--ink-500); font-size: 12px;">${index + 1}</td>
                <td>${new Date(tx.date).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                <td>${tx.clients?.name || '-'}</td>
                ${isSuperAdmin ? `<td>${tx.users?.full_name || '-'}</td>` : ''}
                <td>${tx.description || '-'}</td>
                <td class="numeric-cell negative" style="text-align: ${isRtl ? 'left' : 'right'}">
                  -${Number(tx.amount).toLocaleString(locale, { style: 'currency', currency: 'EGP' })}
                </td>
              </tr>
            `).join('')}
            ${(detailedExpenses || []).length === 0 ? `
              <tr>
                <td colspan="${isSuperAdmin ? 6 : 5}" style="text-align: center; padding: 40px; color: var(--ink-500);">
                  ${t('Transaction.noResults') || 'No expenses recorded currently'}
                </td>
              </tr>
            ` : ''}
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

      try {
        const fontPath = path.join(process.cwd(), 'fonts', 'Cairo.ttf');
        if (fs.existsSync(fontPath)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (chromium as any).font(fontPath);
        }
      } catch (fontError) {
        console.error('Failed to register font:', fontError);
      }

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
      // Local development
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
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    await browser.close();

    const cleanName = user.full_name.trim().replace(/\s+/g, '_');
    const filename = isRtl
      ? `تقرير_ملخص_${cleanName}.pdf`
      : `summary_report_${cleanName}.pdf`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error('Error generating user summary PDF:', error);
    return new NextResponse('Error generating PDF: ' + (error as Error).message, { status: 500 });
  }
}
