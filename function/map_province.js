// วันปิดเวลาไม่ตรงกัน
const provinceData = {
    rayong: {
        name: "ระยอง",
        region: "ภาคกลาง & กรุงเทพฯ",
        examDate: "18 ก.ค. 69",
        abbreviation_en: "RY",
    },

    chonburi: {
        name: "ชลบุรี",
        region: "ภาคกลาง & กรุงเทพฯ",
        examDate: "19 ก.ค. 69",
        abbreviation_en: "CH",
    },

    bangkok: {
        name: "กรุงเทพฯ",
        region: "ภาคกลาง & กรุงเทพฯ",
        examDate: "25 ก.ค. 69",
        abbreviation_en: "BK",
    },

    nakhonpathom: {
        name: "นครปฐม",
        region: "ภาคกลาง & กรุงเทพฯ",
        examDate: "26 ก.ค. 69",
        abbreviation_en: "NP",
    },

    nakhonsawan: {
        name: "นครสวรรค์",
        region: "ภาคกลาง & กรุงเทพฯ",
        examDate: "12 ส.ค. 69",
        abbreviation_en: "NS",
    },

    chiangmai: {
        name: "เชียงใหม่",
        region: "ภาคเหนือ",
        examDate: "1 ส.ค. 69",
        abbreviation_en: "CM",
    },

    chiangrai: {
        name: "เชียงราย",
        region: "ภาคเหนือ",
        examDate: "2 ส.ค. 69",
        abbreviation_en: "CR",
    },

    phuket: {
        name: "ภูเก็ต",
        region: "ภาคใต้",
        examDate: "8 ส.ค. 69",
        abbreviation_en: "PK",
    },

    hatyai: {
        name: "หาดใหญ่",
        region: "ภาคใต้",
        examDate: "9 ส.ค. 69",
        abbreviation_en: "HY",
    },

    suratthani: {
        name: "สุราษฎร์ธานี",
        region: "ภาคใต้",
        examDate: "22 ส.ค. 69",
        abbreviation_en: "SR",
    },

    nakhonsithammarat: {
        name: "นครศรีธรรมราช",
        region: "ภาคใต้",
        examDate: "23 ส.ค. 69",
        abbreviation_en: "NR",
    },

    khonkaen: {
        name: "ขอนแก่น",
        region: "ภาคตะวันออกเฉียงเหนือ",
        examDate: "28 ก.ค. 69",
        abbreviation_en: "KK",
    },

    udonthani: {
        name: "อุดรธานี",
        region: "ภาคตะวันออกเฉียงเหนือ",
        examDate: "29 ก.ค. 69",
        abbreviation_en: "UD",
    },

    ubonratchathani: {
        name: "อุบลราชธานี",
        region: "ภาคตะวันออกเฉียงเหนือ",
        examDate: "15 ส.ค. 69",
        abbreviation_en: "UB",
    },

    nakhonratchasima: {
        name: "นครราชสีมา",
        region: "ภาคตะวันออกเฉียงเหนือ",
        examDate: "16 ส.ค. 69",
        abbreviation_en: "NR",
    },

    surin: {
        name: "สุรินทร์",
        region: "ภาคตะวันออกเฉียงเหนือ",
        examDate: "5 ก.ย. 69",
        abbreviation_en: "SN",
    },

    buriram: {
        name: "บุรีรัมย์",
        region: "ภาคตะวันออกเฉียงเหนือ",
        examDate: "6 ก.ย. 69",
        abbreviation_en: "BR",
    },
};
// สร้าง map จาก abbreviation → province info เพื่อให้ค้นหาเร็ว
const abbreviationMap = {};
for (const key in provinceData) {
    const prov = provinceData[key];
    abbreviationMap[prov.abbreviation_en] = {
        name: prov.name,
        examDate: prov.examDate,
    };
}


function getProvinceInfoByAbbreviation(abbreviation) {
    return abbreviationMap[abbreviation] || null; // ถ้าไม่เจอ return null
}


module.exports = { provinceData, getProvinceInfoByAbbreviation };
