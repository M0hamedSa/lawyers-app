import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/supabase/queries';
import { createClient } from '@/lib/supabase/server';
import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

export const maxDuration = 60; // Allow up to 60 seconds for PDF generation

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (user?.role !== "admin" && user?.role !== "superadmin") {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const date = searchParams.get('date') || '';
    const type = searchParams.get('type') || '';
    const clientId = searchParams.get('client_id') || '';
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
    let dbQuery = supabase
      .from("transactions")
      .select("*, clients(name, profit), users!transactions_created_by_fkey(full_name)")
      .order("date", { ascending: false });

    if (user.role !== "superadmin") {
      dbQuery = dbQuery.eq('created_by', user.id);
    }

    if (clientId) dbQuery = dbQuery.eq('client_id', clientId);
    if (date) dbQuery = dbQuery.eq('date', date);
    if (type === 'payment' || type === 'expense') {
      dbQuery = dbQuery.eq('type', type);
    }

    const { data: transactions, error: dbError } = await dbQuery;

    if (dbError) throw new Error(dbError.message);

    // Apply text search filter if present (Supabase text search is more complex, so we'll keep this part in JS for simplicity or use .ilike)
    let filteredTransactions = transactions || [];
    if (query) {
      const q = query.toLowerCase();
      filteredTransactions = filteredTransactions.filter(t => 
        t.clients.name.toLowerCase().includes(q) || 
        (t.users?.full_name || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
      );
    }

    const transactionsToReport = filteredTransactions;

    let totalIncome = 0;
    let totalExpense = 0;
    let totalProfit = 0;
    const uniqueClientIds = new Set();
    
    transactionsToReport.forEach(t => {
      if (t.type === 'payment') totalIncome += Number(t.amount);
      if (t.type === 'expense') totalExpense += Number(t.amount);
      
      if (user.role === 'superadmin' && t.client_id) {
        if (!uniqueClientIds.has(t.client_id)) {
          uniqueClientIds.add(t.client_id);
          const clientProfit = t.clients?.profit || 0;
          totalProfit += Number(clientProfit);
        }
      }
    });

    if (user.role === 'superadmin') {
      totalIncome = Math.max(0, totalIncome - totalProfit);
    } else {
      totalIncome = user.cash_advance || 0;
    }

    const isRtl = locale === 'ar';
    const reportTitle = clientId && transactionsToReport.length > 0 
      ? `${transactionsToReport[0].clients.name} - ${t('Admin.exportReport')}`
      : t('Admin.exportReport');

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
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 40px;
          }
          .summary-card {
            background: var(--card-bg);
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            border: 1px solid var(--ink-100);
          }
          .summary-label {
            font-size: 11px;
            text-transform: uppercase;
            color: var(--ink-500);
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: 0.05em;
          }
          .summary-value {
            font-size: 18px;
            font-weight: 700;
            color: var(--ink-900);
            white-space: nowrap;
          }
          .summary-value.income { color: #059669; }
          .summary-value.expense { color: #dc2626; }
          
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
            <div class="meta">${t('Dashboard.title')} · ${new Date().toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short' })}</div>
          </div>
          <div style="text-align: ${isRtl ? 'left' : 'right'}">
            <div style="font-weight: 700; color: var(--primary); font-size: 18px;">${t('Sidebar.appName')}</div>
            <div style="font-size: 12px; color: var(--ink-500);">${t('Sidebar.subtitle')}</div>
          </div>
        </div>
        
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">${user.role === 'superadmin' ? t('Dashboard.totalPayments') : 'Cash Advance'}</div>
            <div class="summary-value income">+${totalIncome.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">${user.role === 'superadmin' ? t('Dashboard.totalExpenses') : 'My Expenses'}</div>
            <div class="summary-value expense">-${totalExpense.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">${t('Dashboard.totalBalance')}</div>
            <div class="summary-value">${(totalIncome - totalExpense).toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">${t('ClientDetails.transactions')}</div>
            <div class="summary-value">${transactionsToReport.length}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${t('Transaction.columns.date')}</th>
              <th>${t('Clients.columns.client')}</th>
              <th>${t('Transaction.columns.type')}</th>
              <th>${t('Transaction.columns.description')}</th>
              <th class="amount-cell">${t('Transaction.columns.amount')}</th>
            </tr>
          </thead>
          <tbody>
            ${transactionsToReport.map(t_row => `
              <tr>
                <td>${new Date(t_row.date).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                <td>${t_row.clients?.name || ''}</td>
                <td>${t(t_row.type === 'payment' ? 'Common.payment' : 'Common.expense')}</td>
                <td>${t_row.description}</td>
                <td class="amount-cell ${t_row.type === 'payment' ? 'payment' : 'expense'}">
                  ${t_row.type === 'payment' ? '+' : '-'}${Number(t_row.amount).toLocaleString(locale, { style: 'currency', currency: 'EGP' })}
                </td>
              </tr>
            `).join('')}
            ${transactionsToReport.length === 0 ? `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--ink-500);">${t('Transaction.noResults')}</td></tr>` : ''}
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

      // When using @sparticuz/chromium-min, we must provide a remote URL to the chromium binary pack
      // We use x64 as it's the standard for Vercel serverless functions
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
      const localPuppeteer = await import('puppeteer');
      browser = await localPuppeteer.default.launch({
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

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return new NextResponse('Error generating PDF: ' + (error as Error).message, { status: 500 });
  }
}
