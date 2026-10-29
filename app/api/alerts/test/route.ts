import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { webhookUrl, botToken, chatId, symbol = 'MARKET' } = body;

    const message = `🔔 [GridScout Alert] Test ping successful for ${symbol}!\nRange monitoring and breakout notifications are active.`;

    if (webhookUrl) {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { error: `Webhook returned status ${res.status}: ${text}` },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, message: 'Webhook test alert delivered.' });
    }

    if (botToken && chatId) {
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      });

      const data = await tgRes.json();
      if (!data.ok) {
        return NextResponse.json(
          { error: data.description || 'Telegram API returned an error.' },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, message: 'Telegram message sent successfully.' });
    }

    return NextResponse.json(
      { error: 'Please provide either a Webhook URL or Bot Token + Chat ID.' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to trigger alert test.' },
      { status: 500 }
    );
  }
}
