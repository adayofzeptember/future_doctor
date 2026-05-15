const express = require('express');
const db_FutureDoctor = require('../db/db_connect');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { randomString, radomOTP } = require('../function/random_string');
const requestIp = require('request-ip');
const { sendMailRegister, sendMailOTP } = require('./mail_service');
const formatThaiDate = require('../function/date');
const UAParser = require('ua-parser-js');
const { format, differenceInMinutes } = require('date-fns');
const auth_router = express.Router();
const app = express();

auth_router.get('/ping', (req, res) => {
    res.send('pong auth');
});

auth_router.post('/login', (req, res) => {
    const { user_name, user_password } = req.body;

    if (!user_name || !user_password) {
        return res.status(400).json({ message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user_name)) {
        return res.status(400).json({ message: 'รูปแบบอีเมลไม่ถูกต้อง' });
    }

    const query = `
    SELECT users.*, mod_customer.* 
    FROM users 
    JOIN mod_customer 
      ON users.id_data_role = mod_customer.id_customer 
    WHERE user_name = ?
  `;

    db_FutureDoctor.query(query, [user_name], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                statusCode: 0,
                message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ'
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                statusCode: 0,
                message: 'ไม่พบบัญชี'
            });
        }

        const user = results[0];

        bcrypt.compare(user_password, user.user_password, (err, isMatch) => {
            if (err || !isMatch) {
                return res.status(401).json({
                    statusCode: 0,
                    message: 'รหัสผ่านไม่ถูกต้อง'
                });
            }

            const token = jwt.sign(
                { userId: user.id_data_role },
                process.env.JWT_SECRET,
                { expiresIn: '365d' }
            );

            if (user.user_email_verify == 2) {
                return res.status(200).json({
                    success: true,
                    message: 'ยังไม่ยืนยันอีเมล',
                    statusCode: 2
                });
            }

            // ✅ log ข้อมูล IP + UA
            const normalizeIp = (ip) => {
                if (!ip) return null;
                return ip.startsWith('::ffff:') ? ip.split(':').pop() : ip;
            };

            const ip = normalizeIp(requestIp.getClientIp(req));
            const userAgentRaw = req.headers['user-agent'] || '';
            const formattedDate = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

            const insert_user_login = `
        INSERT INTO user_log_login (id_user_login, create_datetime, ip_address, browser) 
        VALUES (?, ?, ?, ?)
      `;

            db_FutureDoctor.query(insert_user_login, [user.id_data_role, formattedDate, "ip", userAgentRaw], (err2) => {
                if (err2) {
                    console.error('Error inserting into user_log_login:', err2);

                }

                return res.status(200).json({
                    success: true,
                    message: 'เข้าสู่ระบบเสร็จสิ้น',
                    statusCode: 1,
                    ip: ip,
                    user_info: {
                        id: user.id_data_role,
                        name: user.forename,
                        surename: user.surename,
                        email: user.user_email,
                        tel: user.telephone
                    },
                    token: token
                });
            });
        });
    });
});

auth_router.get('/check-email', (req, res) => {
    const { user_email } = req.query;

    const query_checkMail = "SELECT user_email FROM users WHERE user_email = ?";
    db_FutureDoctor.query(query_checkMail, [user_email], (err, results) => {
        if (err) {
            console.error('ERROR QUERY ---> ', err.message);
            return res.status(500).send('error');
        }

        if (results.length > 0) {
            return res.status(200).json({
                status: 0,
                valid: "ซ้ำ",
                message: 'อีเมลนี้ถูกใช้งานแล้ว กรุณาลองใช้อีเมลอื่น'
            });
        } else {
            return res.status(200).json({
                status: 1,
                valid: "ไม่ซ้ำ",
                message: 'อีเมลนี้สามารถลงทะเบียนได้'
            });
        }
    });
});

auth_router.post('/register', async (req, res) => {
    const { email, password, tel, firstname, lastname } = req.body;

    const random_for_id_user = randomString(35);
    const random_for_id_data_role = randomString(35);
    const hashedPassword = await bcrypt.hash(password, 10);

    const formattedDate = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const query_check_dup = 'SELECT user_email FROM users WHERE user_email = ?';


    db_FutureDoctor.query(query_check_dup, [email], (err2, resCheckDup) => {
        if (err2) {
            console.error('Database query error:', err2);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (resCheckDup.length > 0) {
            return res.status(409).json({ success: false, message: 'อีเมลนี้เคยลงทะเบียนไว้แล้ว' });
        }
        //* insert users    
        const insert_user_query = `INSERT INTO users 
                    (id_user, id_data_role ,user_name, user_email, user_password, create_datetime) 
                    VALUES (?, ?, ?, ?, ?, ?)`;
        db_FutureDoctor.query(insert_user_query, [random_for_id_user, random_for_id_data_role, email, email,
            hashedPassword, formattedDate], (err, results) => {
                if (err) {
                    console.error('Error inserting into users: ', err);
                    return res.status(500).json({ success: false, statusCode: 0, message: 'Database insert error users' });
                }

                //! insert mod_cus ชื่อ-สกุล 
                const insert_mod_customer_query = `INSERT INTO mod_customer
                            (id_customer, forename, surename, user_email, create_id, create_datetime, telephone ) VALUES (?, ?, ?, ?, ?, ?, ?)`;
                db_FutureDoctor.query(insert_mod_customer_query, [random_for_id_data_role, firstname, lastname, email, random_for_id_data_role, formattedDate, tel], (err, results) => {
                    if (err) {
                        console.error('Error inserting into mod_customer :', err);
                        return res.status(500).json({ success: false, statusCode: 0, message: 'Database insert error mod_customer' });
                    }


                    const get_sendMail = `select id_customer, user_email_verify from mod_customer where user_email = ?`;


                    db_FutureDoctor.query(get_sendMail, [email], (err, results) => {
                        //*
                        if (err) {
                            console.error('Error sednamil :', err);
                            return res.status(500).json({ success: false, statusCode: 0, message: 'Database insert error mod_customer' });
                        }
                        sendMailRegister(email, "https://future.bewise-global.com/email-verifier", results[0].id_customer, results[0].user_email_verify, 'success')
                            .then(mailResult => {
                                if (!mailResult.success) console.error('ส่งเมลไม่สำเร็จ:', mailResult.error);
                            });
                        return res.status(201).json({
                            success: true,
                            message: 'สมัครสมาชิกเสร็จสิ้น',
                            statusCode: 1,
                            data: {
                                id_user: random_for_id_user,
                                id_data_role: random_for_id_data_role,
                                //user_name: email,
                                user_email: email,
                                create_datetime: formattedDate,
                            }
                        });
                    });
                });
            });
    });
});

auth_router.get('/resend-verification', (req, res) => {
    const { email, type } = req.query;
    const get_resendMail = `select id_customer, user_email_verify from mod_customer where user_email = ?`;

    db_FutureDoctor.query(get_resendMail, [email], (err, results) => {
        //*
        if (err) {
            console.error('Error resednamil :', err);
            return res.status(500).json({ success: false, statusCode: 0, message: 'Database insert error mod_customer' });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูล' });
        }
        sendMailRegister(email, "https://future.bewise-global.com/email-verifier", results[0].id_customer, results[0].user_email_verify, 'success')
            .then(mailResult => {
                if (!mailResult.success) console.error('ส่งเมลไม่สำเร็จ:', mailResult.error);
            });
        return res.status(200).json({
            success: true,
        });
    });
});
 
auth_router.put('/verify', (req, res) => {
    const { id_customer } = req.body;

    const checkUser = 'SELECT * FROM mod_customer WHERE id_customer = ?';

    db_FutureDoctor.query(checkUser, [id_customer], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูล' });
        }

        const now = new Date();
        const formattedDate = format(now, 'yyyy-MM-dd HH:mm:ss');

        const query_update_emailVerify = `
            UPDATE mod_customer
            SET user_email_verify = 1,
                date_email_verify = ?
            WHERE id_customer = ?
        `;

        db_FutureDoctor.query(query_update_emailVerify, [formattedDate, id_customer], (err, resultUpdate) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
            }

            if (resultUpdate.affectedRows === 0) {
                return res.status(400).json({ message: 'ไม่สามารถอัปเดต mod_customer ได้' });
            }
            //

            const query_update_Users = `
            UPDATE users
            SET status = 1
            WHERE id_data_role = ?`;

            db_FutureDoctor.query(query_update_Users, [id_customer], (err, resultUpdate2) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
                }

                if (resultUpdate2.affectedRows === 0) {
                    return res.status(400).json({ message: 'ไม่สามารถอัปเดต users ได้' });
                }

                return res.status(200).json({ message: 'ยืนยันอีเมลสำเร็จ' });
            });

        });
    });
});

auth_router.put('/send-reset-otp', (req, res) => {
    const { user_email } = req.query;
    const formattedDate = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const random_opt = radomOTP(6);

    const update_verifyCode = `
            UPDATE mod_customer
            SET verification_code = ?,
                date_verification_code = ?
            WHERE user_email = ?
        `;

    db_FutureDoctor.query(update_verifyCode, [random_opt, formattedDate, user_email], (err, results) => {
        if (err) {
            console.error('Error update :', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูล' });
        }


        const getName = `SELECT forename, surename FROM mod_customer WHERE user_email = ?`;
        db_FutureDoctor.query(getName, [user_email], (err2, rows) => {
            if (err2) {
                console.error('Error select :', err2);
                return res.status(500).json({ success: false, message: 'Database error' });
            }

            const fullname = rows.length > 0 ? rows[0].forename + " " + rows[0].surename : "";

            sendMailOTP(user_email, random_opt, fullname, formatThaiDate(new Date()))
                .then(mailResult => {
                    if (!mailResult.success) console.error('ส่งเมลไม่สำเร็จ:', mailResult.error);
                });

            return res.status(200).json({
                success: true,

            });
        });
    });
});

auth_router.post('/verify-reset-otp', (req, res) => {
    const { user_email, otp } = req.body;

    const query = `
        SELECT verification_code, date_verification_code
        FROM mod_customer 
        WHERE user_email = ?`;

    db_FutureDoctor.query(query, [user_email], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ statusCode: 0, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }

        if (results.length === 0) {
            return res.status(401).json({ statusCode: 0, message: 'ไม่พบบัญชี' });
        }

        const dbOtp = results[0].verification_code;
        const dbDateStr = results[0].date_verification_code;

 
        const otpDate = new Date(dbDateStr);
        const now = new Date();

        const diffMinutes = differenceInMinutes(now, otpDate);

        if (diffMinutes > 15) {
            return res.status(400).json({
                success: false,
                message: 'OTP หมดอายุ (เกิน 15 นาที)'
            });
        }

        if (dbOtp === otp) {
            return res.status(200).json({
                success: true,
                message: 'OTP ถูกต้อง'
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'OTP ไม่ถูกต้อง'
            });
        }
    });
});

auth_router.put('/reset-password', async (req, res) => {
    const { email, newPassword, otp_status } = req.body;

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    const formattedDate = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const query_update_password = `
            UPDATE users
            SET user_password = ?,
            passwd_changed = ?,
            update_datetime = ?
            WHERE user_email = ?
        `;

    db_FutureDoctor.query(query_update_password, [hashedNewPassword, formattedDate, formattedDate, email], (err, resultUpdate) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }

        if (resultUpdate.affectedRows === 0) {
            return res.status(400).json({ success: false, message: 'ไม่สามารถอัปเดต password ได้' });
        }

        return res.status(200).json({
            success: true,
            message: 'เปลี่ยนรหัสผ่านสำเร็จ'
        });

    });
});

auth_router.get('/testip', (req, res) => {

    const normalizeIp = (ip) => {
        if (!ip) return null;
        return ip.startsWith('::ffff:') ? ip.split(':').pop() : ip;
    };

    const ip = normalizeIp(requestIp.getClientIp(req));

    const userAgentRaw = req.headers['user-agent'] || '';


    return res.json({
        success: true,
        addres: ip,
        device: userAgentRaw,


    });
});


module.exports = auth_router;
