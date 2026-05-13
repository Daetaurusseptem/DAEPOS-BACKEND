import jwt from 'jsonwebtoken';

export const generarJWT = (uid:string) => {

    return new Promise((resolve, reject) => {

        const payload = {
            uid
        };

        jwt.sign(payload,
            process.env.JWT as string, {
                expiresIn: '24h'
            },
            (err, token) => {
                if (err) {
                    reject('could not generate JWT')
                }else{
                    resolve(token)
                }

            }
        )

    })

}
