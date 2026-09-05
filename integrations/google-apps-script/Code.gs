const DESTINATION_EMAIL = 'steff@joycafe28.com';
const SENDER_NAME = 'Joy Website Reservations';

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function cleanLine(value, maxLength) {
  return String(value || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function(character) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
  });
}

function doGet() {
  return jsonResponse({ ok: true, service: 'joy-reservations' });
}

// Run this once from the Apps Script editor so Google can request only the
// permission needed to send mail. It does not send a message.
function authorise() {
  return MailApp.getRemainingDailyQuota();
}

function doPost(event) {
  try {
    const input = JSON.parse(event && event.postData ? event.postData.contents : '{}');
    const expectedSecret = PropertiesService.getScriptProperties().getProperty('BOOKING_WEBHOOK_SECRET');
    if (!expectedSecret || !input.secret || input.secret !== expectedSecret) {
      console.warn(JSON.stringify({ event: 'reservation_webhook_rejected' }));
      return jsonResponse({ ok: false });
    }

    const source = input.reservation || {};
    const reservation = {
      name: cleanLine(source.name, 100),
      partySize: Number(source.partySize),
      date: cleanLine(source.date, 10),
      dateLabel: cleanLine(source.dateLabel, 80),
      time: cleanLine(source.time, 5),
      timeLabel: cleanLine(source.timeLabel, 20),
      email: cleanLine(source.email, 254).toLowerCase(),
      phone: cleanLine(source.phone, 40),
      requests: String(source.requests || '').replace(/\r\n?/g, '\n').trim().slice(0, 1000)
    };

    if (!reservation.name || !Number.isInteger(reservation.partySize) || reservation.partySize < 1 || reservation.partySize > 6 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(reservation.date) || !/^\d{2}:\d{2}$/.test(reservation.time) ||
        !/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(reservation.email) || !reservation.phone) {
      console.warn(JSON.stringify({ event: 'reservation_payload_rejected' }));
      return jsonResponse({ ok: false });
    }

    const requests = reservation.requests || 'None provided';
    const rows = [
      ['Name', reservation.name],
      ['Number of people', reservation.partySize],
      ['Date', reservation.dateLabel],
      ['Time', reservation.timeLabel],
      ['Email', reservation.email],
      ['Phone', reservation.phone],
      ['Dietaries, allergies or special requests', requests]
    ];
    const subject = 'New table reservation request: ' + reservation.name + ', ' + reservation.date + ' at ' + reservation.time;
    const text = ['New table reservation request', ''].concat(rows.map(function(row) {
      return row[0] + ': ' + row[1];
    }), ['', 'This is a reservation request, not an automatic confirmation.']).join('\n');
    const htmlRows = rows.map(function(row) {
      return '<tr><th style="padding:10px 14px;text-align:left;vertical-align:top;border-bottom:1px solid #deded8">' + escapeHtml(row[0]) + '</th><td style="padding:10px 14px;border-bottom:1px solid #deded8;white-space:pre-wrap">' + escapeHtml(row[1]) + '</td></tr>';
    }).join('');
    const html = '<div style="font-family:Arial,sans-serif;color:#272a22;max-width:680px"><h1 style="font-size:24px">New table reservation request</h1><table style="width:100%;border-collapse:collapse">' + htmlRows + '</table><p style="margin-top:18px"><strong>This is a reservation request, not an automatic confirmation.</strong></p></div>';

    MailApp.sendEmail({
      to: DESTINATION_EMAIL,
      subject: subject,
      body: text,
      htmlBody: html,
      name: SENDER_NAME,
      replyTo: reservation.email
    });
    console.log(JSON.stringify({ event: 'reservation_email_sent' }));
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(JSON.stringify({ event: 'reservation_email_failed' }));
    return jsonResponse({ ok: false });
  }
}
