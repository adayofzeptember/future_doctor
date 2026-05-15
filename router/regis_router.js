const express = require('express');
const db_FutureDoctor = require('../db/db_connect');
const regis_router = express.Router();
const verifyToken = require('../function/token');
const { randomString } = require('../function/random_string');
const { sendMailRegisSinglePass, sendMailRegisGroup, sendMailGroupJoin } = require('./mail_service');
const { getProvinceInfoByAbbreviation } = require("../function/map_province");
const formatThaiDate = require('../function/date');
const { format } = require('date-fns');

regis_router.post('/', verifyToken, async (req, res) => {
    const {
        applicant_code,
        leader_id,
        national_id,
        first_name,
        last_name,
        phone,
        email,
        school,
        address,
        subdistrict,
        district,
        province,
        zipcode,
        grade_level,
        major,
        //* ใช้เมล
        package_id,
        package_name,
        price
    } = req.body;

    const gradeLevelVal = grade_level ?? "";
    const majorVal = major ?? "";
    const addressline = `${address}, ${subdistrict}, ${district}, ${province}, ${zipcode}`;
    const insert_regis = `
    INSERT INTO registrations (
      user_id,
      group_id,
      idcard,
      firstname,
      lastname,
      phone,
      email_register,
      class_level,
      subject_line,
      school,
      address,
      create_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    db_FutureDoctor.query(
        insert_regis,
        [
            leader_id,
            applicant_code,
            national_id,
            first_name,
            last_name,
            phone,
            email,
            gradeLevelVal,
            majorVal,
            school,
            addressline,
            applicant_code
        ],
        (err) => {
            if (err) {
                console.error('Error inserting into registrations: ', err);
                return res.status(500).json({
                    success: false,
                    message: 'Database insert error registrations'
                });
            }

            const lastTwo = leader_id.slice(-2);
            const info_province = getProvinceInfoByAbbreviation(lastTwo);

            const { th } = require('date-fns/locale');
            const formattedDate = format(new Date(), 'dd MMMM yyyy', { locale: th });

            if (package_id == 1) {
                // ✅ สมัครสอบเดี่ยว
                sendMailRegisSinglePass(
                    email,
                    leader_id,
                    first_name + " " + last_name,
                    package_name,
                    info_province.name,
                    info_province.examDate,
                    price,
                    formatThaiDate(new Date())
                ).then(mailResult => {
                    if (!mailResult.success) {
                        console.error('ส่งเมลสมัครสอบเดี่ยวไม่สำเร็จ:', mailResult.error);
                    }
                });
            } else {
                // ✅ สมัครสอบกลุ่ม
                const getLink = `SELECT * FROM application_groups WHERE leader_user_id = ?`;
                db_FutureDoctor.query(getLink, [leader_id], (err, resultLink) => {
                    if (err) {
                        console.error('Error get unique_link : ', err);
                        return res.status(500).json({
                            success: false,
                            message: 'Error get unique_link'
                        });
                    }
                    sendMailRegisGroup(
                        email,
                        leader_id,
                        first_name + " " + last_name,
                        package_name,
                        info_province.name,
                        info_province.examDate,
                        price,
                        formatThaiDate(new Date()),
                        resultLink[0].unique_link
                    ).then(mailResult => {
                        if (!mailResult.success) {
                            console.error('ส่งเมลสมัครสอบกลุ่มไม่สำเร็จ:', mailResult.error);
                        }
                    });
                });
            }

            return res.status(201).json({
                success: true,
                message: 'สมัครสอบเสร็จสิ้น, ตรวจสอบอีเมล'
            });
        }
    );
});

regis_router.get('/packages', verifyToken, (req, res) => {
    setTimeout(() => {
        const get_profile_query = "select * from packages";
        db_FutureDoctor.query(get_profile_query, (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
            }
            if (results.length === 0) {
                return res.status(401).json({ message: 'ไม่พบข้อมูล-' });
            }

            res.status(200).json({
                success: true,
                packages: results
            });
        });
    }, 1000);

});

regis_router.get('/check-package-selection', verifyToken, (req, res) => {
    const { user_id } = req.query;

    const query = "select applicant_code, package_code, leader_user_id, unique_link ,create_date from application_groups where applicant_code = ?";
    db_FutureDoctor.query(query, [user_id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }
        if (results.length === 0) {
            return res.status(200).json({
                success: true,
                code: 0,
                message: "ยังไม่เลือกแพ็คเกจ"
            });
        }

        return res.status(200).json({
            success: true,
            code: 1,
            package_code: results[0].package_code,
            date: results[0].create_date,
            leader_id: results[0].leader_user_id,
            unique_link: results[0].unique_link,
            message: "เลือกแพ็คเกจแล้ว"
        });
    });
});

regis_router.post('/select-package', verifyToken, async (req, res) => {
    const { applicant_code, city_code, package_code } = req.body;

    const gen_unique_link = randomString(10).toUpperCase();


    // ✅ ดึงเลขล่าสุดเฉพาะ city_code นั้น ๆ
    const select_last_id = `
        SELECT leader_user_id 
        FROM application_groups 
        WHERE LEFT(leader_user_id, 2) = '26' 
          AND RIGHT(leader_user_id, CHAR_LENGTH(?)) = ? 
        ORDER BY leader_user_id DESC 
        LIMIT 1
    `;

    db_FutureDoctor.query(select_last_id, [city_code, city_code], (err, results) => {
        if (err) {
            console.error('Error DB: ', err);
            return res.status(500).json({
                success: false,
                statusCode: 0,
                message: 'Database select leader_user_id error application_groups'
            });
        }


        let nextNumStr = '000001';

        if (results.length > 0) {
            const lastId = results[0].leader_user_id;

            const numPart = lastId.slice(2, lastId.length - city_code.length);

            const nextNum = (parseInt(numPart, 10) || 0) + 1;
            nextNumStr = String(nextNum).padStart(6, '0');
        }

        const gen_leader_id = `26${nextNumStr}${city_code}`;

        const insert_application_group = `
            INSERT INTO application_groups 
                (leader_user_id, package_code, status, unique_link, applicant_code) 
            VALUES (?, ?, ?, ?, ?)
        `;

        db_FutureDoctor.query(
            insert_application_group,
            [gen_leader_id, package_code, 'PENDING_MEMBERS', gen_unique_link, applicant_code],
            (err2) => {
                if (err2) {
                    console.error('Error inserting into application_groups: ', err2);
                    return res.status(500).json({
                        success: false,
                        message: 'Database insert error application_groups: ' + err2
                    });
                }

                return res.status(201).json({
                    success: true,
                    message: 'บันทึกข้อมูลแพ็คเกจเสร็จสิ้น',
                    new_id: gen_leader_id
                });
            }
        );
    });
});

regis_router.get('/check-id', verifyToken, (req, res) => {

    const { id } = req.query;

    const query = "select idcard from registrations where idcard = ?";
    db_FutureDoctor.query(query, [id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }
        if (results.length === 0) {
            return res.status(200).json({
                success: true,
                code: 0,
                message: "เลขบัตรประชาชนไม่ซ้ำ"
            });
        }
        return res.status(200).json({
            success: true, code: 1,
            message: "เลขบัตรประชาชนซ้ำ"
        });
    });


});

regis_router.get('/check-registration-status', verifyToken, (req, res) => {

    const { user_id } = req.query;

    const query = "select create_id from registrations where create_id = ?";
    db_FutureDoctor.query(query, [user_id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }
        if (results.length === 0) {
            return res.status(200).json({
                success: true,
                code: 0,
                message: "ยังไม่ได้สมัคร"
            });
        }

        return res.status(200).json({
            success: true,
            code: 1,
            message: "สมัครแล้ว"
        });
    });


});

regis_router.get('/group/deadline', verifyToken, (req, res) => {

    const { user_id } = req.query;

    const query = "select create_date from application_groups where applicant_code = ?";
    db_FutureDoctor.query(query, [user_id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูล'
            });
        }

        return res.status(200).json({
            success: true,
            message: "ดึงเวลาสำเร็จ",
            create_time: results[0].create_date,
        });
    });

});

regis_router.get('/group/info/:uniquelink', (req, res) => {

    const { uniquelink } = req.params;

    const query = `
        SELECT 
            ag.leader_user_id, 
            ag.package_code, 
            ag.create_date as deadline, 
            ag.unique_link, 
            ag.applicant_code, 
            ag.status,
            p.name as packageName, 
            p.price_text, 
            p.max_qty as maxMembers, 
            r.firstname,
            (SELECT COUNT(*) FROM registrations reg WHERE reg.user_id = ag.leader_user_id AND reg.group_id = ag.applicant_code) as currentMembers
        FROM application_groups ag
        JOIN packages p ON ag.package_code = p.code
        LEFT JOIN registrations r ON ag.applicant_code = r.create_id
        WHERE ag.unique_link = ?
    `;
    db_FutureDoctor.query(query, [uniquelink], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูล'
            });
        }

        return res.status(200).json({
            success: true,
            message: "สำเร็จ",
            data: results[0]
        });
    });
});

regis_router.get('/check-id-exists', (req, res) => {

    const { id: encodedId } = req.query;
    if (!encodedId) {
        return res.status(400).json({ message: 'ID is required' });
    }
    const id = Buffer.from(encodedId, 'base64').toString('utf8');
    const query = "select idcard from registrations where idcard = ?";
    db_FutureDoctor.query(query, [id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }
        if (results.length === 0) {
            return res.status(200).json({
                success: true,
                code: 0,
                message: "เลขบัตรประชาชนไม่ซ้ำ"
            });
        }

        return res.status(200).json({
            success: true, code: 1,
            message: "เลขบัตรประชาชนซ้ำ"
        });
    });


});

regis_router.post('/group/join', async (req, res) => {
    const {
        leader_user_id,
        applicant_code,
        national_id,
        first_name,
        last_name,
        phone,
        email,
        school,
        grade_level,
        major,
        head_name
    } = req.body;


    const gradeLevelVal = grade_level ?? "";
    const majorVal = major ?? "";
    const random_for_createID = randomString(35);
    const insert_regisJoin = `
        INSERT INTO registrations 
        (user_id, group_id, idcard, firstname, lastname, phone, email_register, class_level, subject_line, school, create_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db_FutureDoctor.query(
        insert_regisJoin,
        [
            leader_user_id, // userID
            applicant_code,  // group ID
            national_id,
            first_name,
            last_name,
            phone,
            email,
            gradeLevelVal,
            majorVal,
            school,
            random_for_createID
        ],

        (err) => {
            if (err) {
                console.error('Error inserting into registrations [JOIN]: ', err);
                return res.status(500).json({
                    success: false,
                    message: 'Database insert error registrations'
                });
            }

            const lastTwo = leader_user_id.slice(-2);
            const info_province = getProvinceInfoByAbbreviation(lastTwo);

            const { th } = require('date-fns/locale');

            const formattedDate = format(new Date(), 'dd MMMM yyyy', { locale: th });


            sendMailGroupJoin(email, leader_user_id, head_name, first_name + " " + last_name, info_province.name, info_province.examDate, formattedDate)
                .then(mailResult => {
                    if (!mailResult.success) console.error('ส่งเมลสมัครร่วมกลุ่มไม่สำเร็จ:', mailResult.error);
                });

            return res.status(201).json({
                success: true,
                message: 'สมัครสอบเสร็จสิ้น [JOINED GROUP]'
            });
        }
    );
});

regis_router.post('/group/track-view', async (req, res) => {
    const { leader_id, unique_link, timestamp } = req.body;

    const formattedDate = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const get_totalView = "SELECT total_views FROM group_stats WHERE leader_user_id = ?";

    db_FutureDoctor.query(get_totalView, [leader_id], (err, results) => {
        if (err) {
            console.error('Error get total_views from group_stats: ', err);
            return res.status(500).json({
                success: false,
                message: 'Error get total_views from group_stats'
            });
        }

        if (results.length === 0) {

            // ไม่เจอ leader_id → insert ใหม่ total_views = 0
            const insertNew = `
                INSERT INTO group_stats 
                (leader_user_id, unique_link, total_views, create_datetime) 
                VALUES (?, ?, ?, ?)
            `;
            db_FutureDoctor.query(insertNew, [leader_id, unique_link, 1, formattedDate], (err) => {
                if (err) {
                    console.error('Error inserting new row: ', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Database insert error'
                    });
                }
                return res.status(201).json({
                    success: true,
                    message: 'เพิ่มข้อมูลเสร็จสิ้น',

                });
            });
        } else {
            // lol เจอ id leader_user → total_views + 1 แล้ว update เฉพาะ total_views 
            const currentViews = results[0].total_views || 0;
            const newViews = currentViews + 1;

            const updateView = `
                UPDATE group_stats 
                SET total_views = ?
                WHERE leader_user_id = ?
            `;
            db_FutureDoctor.query(updateView, [newViews, leader_id], (err) => {
                if (err) {
                    console.error('Error updating total_views: ', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Database update error'
                    });
                }
                return res.status(200).json({
                    success: true,
                    message: 'อัพเดต total_views สำเร็จ',
                    total_views: newViews
                });
            });
        }
    });
});

regis_router.get('/group/share-stats', (req, res) => {

    const { leader_id } = req.query;

    const query = "SELECT total_views FROM group_stats WHERE leader_user_id = ?";
    db_FutureDoctor.query(query, [leader_id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }
        if (results.length === 0) {
            return res.status(200).json({
                success: true,
                message: "ไม่พบ leader_id "
            });
        }

        return res.status(200).json({
            success: true,
            total_views: results[0].total_views,
        });
    });


});

regis_router.get('/group/members', (req, res) => {

    const { user_id, leader_id } = req.query;

    const query = "SELECT firstname, lastname, phone, email_register,create_id, create_datetime FROM registrations WHERE user_id = ? AND group_id = ? ";
    db_FutureDoctor.query(query, [user_id, leader_id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }
        if (results.length === 0) {
            return res.status(200).json({
                success: true,
                message: "ไม่พบข้อมูล"
            });
        }

        return res.status(200).json({
            success: true,
            count: results.length,

            results
        });
    });


});

regis_router.post('/group/find-member', (req, res) => {
    const { group_id, national_id } = req.body;

    const query = "SELECT * FROM registrations WHERE group_id = ? AND idcard = ?";
    db_FutureDoctor.query(query, [group_id, national_id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }


        if (results.length === 0) {
            return res.status(200).json({
                success: true,
                message: "ไม่พบข้อมูล",

            });
        }

        return res.status(200).json({
            success: true,
            message: "พบข้อมูล",
            result: results[0]


        });
    });
});

regis_router.get('/get-user-address', verifyToken, (req, res) => {

    const { user_id } = req.query;

    const query = "SELECT address FROM registrations WHERE create_id = ? ";
    db_FutureDoctor.query(query, [user_id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }
        if (results.length === 0) {
            return res.status(200).json({
                success: true,
                message: "ไม่พบข้อมูล"
            });
        }

        return res.status(200).json({
            success: true,

            address: results[0]
        });
    });


});

regis_router.get('/get-payment-status', (req, res) => {
    const { user_id } = req.query;

    const query = `
        SELECT * 
        FROM application_groups 
        WHERE applicant_code = ? 
          AND status = 'COMPLETED'`;

    db_FutureDoctor.query(query, [user_id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }

        if (results.length === 0) {
            return res.status(200).json({
                success: false,
                status: 'INCOMPLETE'
            });
        }

        return res.status(200).json({
            success: true,
            status: results[0].status

        });
    });
});

regis_router.get('/seats-status', (req, res) => {

    const query = `SELECT 
    province_code,
    current_seats
FROM (
    SELECT 
        RIGHT(student_id, 2) as province_code,
        COUNT(*) as current_seats
    FROM registrations 
    WHERE student_id IS NOT NULL 
        AND student_id != ''
    GROUP BY RIGHT(student_id, 2)
    UNION ALL
    SELECT 
        'RY' as province_code, 0 as current_seats UNION ALL
    SELECT 'CH', 0 UNION ALL
    SELECT 'NS', 0 UNION ALL
    SELECT 'BK', 0 UNION ALL
    SELECT 'HY', 0 UNION ALL
    SELECT 'NR', 0 UNION ALL
    SELECT 'SR', 0 UNION ALL
    SELECT 'PK', 0 UNION ALL
    SELECT 'CM', 0 UNION ALL
    SELECT 'CR', 0 UNION ALL
    SELECT 'UB', 0 UNION ALL
    SELECT 'KR', 0 UNION ALL
    SELECT 'KK', 0 UNION ALL
    SELECT 'UD', 0
) AS seat_data`;

    db_FutureDoctor.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }

        if (results.length === 0) {
            return res.status(200).json({
                success: false,
                status: 'INCOMPLETE'
            });
        }

        return res.status(200).json({
            success: true,
            "seats": results

        });
    });
});

regis_router.get('/group/members/print', (req, res) => {
    const { leader_id, user_id } = req.query;
    const query = `SELECT 
    
   user_id,
    group_id,
    idcard,
    student_id,
    firstname,
    lastname,
    phone,
    email_register,
    school,
    address,
    seat_number,
    create_id

    from registrations WHERE user_id = ? AND group_id = ?`;

    db_FutureDoctor.query(query, [user_id, leader_id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }

        if (results.length === 0) {
            return res.status(200).json({
                success: false,
                message: "ไม่เจอข้อมูล"
            });
        }

        return res.status(200).json({
            success: true,
            "data": results

        });
    });
});

regis_router.get('/ticket/print', (req, res) => {
    const { leader_id, member_id } = req.query;
    const query = `SELECT 
    
   user_id,
    group_id,
    idcard,
    student_id,
    firstname,
    lastname,
    phone,
    email_register,
    school,
    address,
    seat_number,
    create_id

    from registrations WHERE user_id = ? AND create_id = ?`;

    db_FutureDoctor.query(query, [leader_id, member_id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }

        if (results.length === 0) {
            return res.status(200).json({
                success: false,
                message: "ไม่เจอข้อมูล"
            });
        }

        return res.status(200).json({
            success: true,
            "data": results[0]

        });
    });
});


module.exports = regis_router;        
