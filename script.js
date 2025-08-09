// This is a backup of the original script.js file.

function isAsxMarketOpen() {
    const now = new Date();
    const options = {
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
        timeZone: 'Australia/Sydney',
        weekday: 'short',
    };

    const sydneyTimeStr = new Intl.DateTimeFormat('en-AU', options).format(now);

    // Validate the format of sydneyTimeStr
    if (!sydneyTimeStr.includes(', ')) {
        console.error('Unexpected format for Sydney time string:', sydneyTimeStr);
        return false; // Default to closed if format is unexpected
    }

    const [dayOfWeekStr, timeStr] = sydneyTimeStr.split(', ');
    const [hours, minutes] = timeStr.split(':').map(Number);

    // Map weekday strings to numbers (Sunday = 0, Monday = 1, ..., Saturday = 6)
    const dayOfWeekMap = {
        'Sun': 0,
        'Mon': 1,
        'Tue': 2,
        'Wed': 3,
        'Thu': 4,
        'Fri': 5,
        'Sat': 6
    };

    const dayOfWeek = dayOfWeekMap[dayOfWeekStr];

    if (dayOfWeek === undefined) {
        console.error('Unexpected day of week string:', dayOfWeekStr);
        return false; // Default to closed if day of week is invalid
    }

    // Custom schedule logic
    if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) {
        // Closed all weekend (Friday, Saturday, Sunday)
        return false;
    }

    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
        // Closed from 12:01 AM to 11:59 PM Monday to Thursday
        return false;
    }

    // Default to closed if none of the above conditions are met
    return false;
}
