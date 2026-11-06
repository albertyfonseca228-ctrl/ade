/**
 * Creator script class IDs preserve the first FIVE hexadecimal digits (23 chars).
 * Asset UUID compression preserving two digits (22 chars) is not interchangeable.
 * Confirmed against Creator 3.8.8's generated cclegacy._RF.push registration.
 */
function scriptClassId(uuid) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
        throw new Error(`Invalid script UUID: ${uuid}`);
    }
    const hex = uuid.replace(/-/g, '').toLowerCase();
    const base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = hex.slice(0, 5);
    for (let i = 5; i < 32; i += 3) {
        const bits = parseInt(hex.slice(i, i + 3), 16);
        result += base64[bits >> 6] + base64[bits & 63];
    }
    return result;
}

function scriptUuid(classId) {
    if (!/^[0-9a-f]{5}[A-Za-z0-9+/]{18}$/i.test(classId)) throw new Error(`Invalid script class ID: ${classId}`);
    const base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let hex = classId.slice(0, 5);
    for (let i = 5; i < classId.length; i += 2) {
        hex += ((base64.indexOf(classId[i]) << 6) | base64.indexOf(classId[i + 1])).toString(16).padStart(3, '0');
    }
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

module.exports = { scriptClassId, scriptUuid };
