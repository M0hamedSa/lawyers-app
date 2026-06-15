import { NextResponse } from 'next/server';
import { getCurrentUser, getAllUsers } from '@/lib/supabase/queries';
import { createClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';

export const maxDuration = 60; // Allow up to 60 seconds for PDF generation

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'superadmin') {
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

    const supabase = await createClient();
    const users = await getAllUsers();

    // Fetch all expenses to calculate totals
    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount, created_by")
      .eq("type", "expense");

    const userExpenses = (transactions || []).reduce((acc, t_row) => {
      if (t_row.created_by) {
        acc[t_row.created_by] = (acc[t_row.created_by] || 0) + Number(t_row.amount);
      }
      return acc;
    }, {} as Record<string, number>);

    let totalAdvances = 0;
    let totalExpensesSum = 0;
    let totalBalanceSum = 0;

    const usersData = users
      .filter(u => u.role !== 'superadmin')
      .map(u => {
        const expenses = userExpenses[u.id] || 0;
        const advance = u.cash_advance || 0;
        const balance = advance - expenses;

        totalAdvances += advance;
        totalExpensesSum += expenses;
        totalBalanceSum += balance;

        return {
          ...u,
          total_expenses: expenses,
          balance: balance
        };
      });

    const isRtl = locale === 'ar';
    const reportTitle = t('CashAdvance.reportTitle') || 'Cash Advance Report';

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
          .amount-cell {
            text-align: ${isRtl ? 'left' : 'right'};
            font-weight: 600;
            font-family: ${isRtl ? "'Cairo', sans-serif" : "'Inter', sans-serif"};
            white-space: nowrap;
          }
          .payment { color: #059669; }
          .expense { color: #dc2626; }
          
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid var(--ink-100);
            text-align: center;
            font-size: 12px;
            color: var(--ink-500);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h1>${reportTitle}</h1>
            <div class="meta">${t('CashAdvance.title')} · ${new Date().toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short' })}</div>
          </div>
          <div style="text-align: ${isRtl ? 'left' : 'right'}">
            <div style="font-weight: 700; color: var(--primary); font-size: 18px;">${t('Sidebar.appName')}</div>
            <div style="font-size: 12px; color: var(--ink-500);">${t('Sidebar.subtitle')}</div>
          </div>
        </div>
        
        <div class="summary-strip">
          <div class="summary-item">
            <div class="summary-label">${t('CashAdvance.totalAdvances')}</div>
            <div class="summary-value income">${totalAdvances.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${t('CashAdvance.totalUserExpenses')}</div>
            <div class="summary-value expense">${totalExpensesSum.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${t('CashAdvance.netBalance')}</div>
            <div class="summary-value ${totalBalanceSum >= 0 ? 'balance-positive' : 'balance-negative'}">${totalBalanceSum.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>${t('CashAdvance.userName')}</th>
              <th>${t('CashAdvance.role')}</th>
              <th class="amount-cell">${t('CashAdvance.currentAdvance')}</th>
              <th class="amount-cell">${t('CashAdvance.totalExpenses')}</th>
              <th class="amount-cell">${t('CashAdvance.currentBalance')}</th>
            </tr>
          </thead>
          <tbody>
            ${usersData.map((u_row, index) => `
              <tr>
                <td style="text-align: center; color: var(--ink-500); font-size: 12px;">${index + 1}</td>
                <td>${u_row.full_name || ''}</td>
                <td>${t('Roles.' + u_row.role)}</td>
                <td class="amount-cell">
                  ${Number(u_row.cash_advance || 0).toLocaleString(locale, { style: 'currency', currency: 'EGP' })}
                </td>
                <td class="amount-cell expense">
                  ${Number(u_row.total_expenses).toLocaleString(locale, { style: 'currency', currency: 'EGP' })}
                </td>
                <td class="amount-cell ${u_row.balance < 0 ? 'expense' : 'payment'}">
                  ${Number(u_row.balance).toLocaleString(locale, { style: 'currency', currency: 'EGP' })}
                </td>
              </tr>
            `).join('')}
            ${usersData.length === 0 ? `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--ink-500);">${t('CashAdvance.noUsers')}</td></tr>` : ''}
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

      // Register Arabic font for production
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

    // Wait for fonts to be loaded
    await page.evaluateHandle('document.fonts.ready');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    await browser.close();

    const generatedFilename = locale === 'ar' ? "تقرير_العهد_المالية.pdf" : "cash_advance_report.pdf";

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(generatedFilename)}"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return new NextResponse('Error generating PDF: ' + (error as Error).message, { status: 500 });
  }
}
