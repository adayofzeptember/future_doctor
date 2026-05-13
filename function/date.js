const { format } = require('date-fns');
const { th } = require('date-fns/locale');

function formatThaiDate(date = new Date()) {
    const buddhistYear = date.getFullYear() + 543;

    const dayMonth = format(date, "d MMMM", { locale: th });
    return `${dayMonth} ${buddhistYear}`;

}

module.exports = formatThaiDate;