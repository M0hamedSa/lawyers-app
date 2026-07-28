import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') || 'en';
    if (!['en', 'ar'].includes(locale)) {
      return new NextResponse('Invalid locale', { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: currentUser } = await supabase
      .from('users')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (currentUser?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    const escapeHtml = (s: string): string =>
      s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*, clients(name), cases(title), users!transactions_created_by_fkey(full_name)')
      .eq('type', 'office')
      .order('date', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ error: 'NO_DATA' }, { status: 200 });
    }

    const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const isRtl = locale === 'ar';

    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    const logoSrc = fs.existsSync(logoPath)
      ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
      : '';

    const exportedAt = `${currentUser.full_name} · ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${locale}" dir="${isRtl ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="UTF-8">
        <title>${t('Admin.officeTransactions')}</title>
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
          .summary-value.office { color: #dc2626; }
          
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
          .office { color: #dc2626; }
          
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
            <h1>${t('Admin.officeTransactions')}</h1>
            <div class="meta"><span dir="ltr">${exportedAt}</span></div>
          </div>
        </div>
        
        <div class="summary-strip">
          <div class="summary-item">
            <div class="summary-label">${t('Admin.totalOffice')}</div>
            <div class="summary-value office">-${totalAmount.toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${isRtl ? 'عدد المعاملات' : 'Transaction Count'}</div>
            <div class="summary-value">${transactions.length}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>${t('Transaction.columns.date')}</th>
              <th>${t('Transaction.columns.createdBy')}</th>
              <th>${t('Clients.columns.client')}</th>
              <th>${t('Cases.title') || 'Case'}</th>
              <th>${t('Transaction.columns.voucher')}</th>
              <th>${t('Transaction.columns.description')}</th>
              <th class="amount-cell">${t('Transaction.columns.amount')}</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map((t_row, index) => `
              <tr>
                <td style="text-align: center; color: var(--ink-500); font-size: 12px;">${index + 1}</td>
                <td>${new Date(t_row.date).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                <td>${escapeHtml(t_row.users?.full_name || '-')}</td>
                <td>${escapeHtml(t_row.clients?.name || '-')}</td>
                <td>${escapeHtml(t_row.cases?.title || '-')}</td>
                <td>${t_row.voucher_type ? t('Transaction.vouchers.' + t_row.voucher_type) : ''}</td>
                <td>${escapeHtml(t_row.description)}</td>
                <td class="amount-cell office">-${Number(t_row.amount).toLocaleString(locale, { style: 'currency', currency: 'EGP' })}</td>
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

    const todayStr = new Date().toISOString().split('T')[0];
    const filename = isRtl ? `تقرير_معاملات_المكتب_${todayStr}.pdf` : `office_transactions_report_${todayStr}.pdf`;
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error('Error generating office report PDF:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return new NextResponse('Internal server error: ' + msg, { status: 500 });
  }
}
