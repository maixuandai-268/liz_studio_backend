/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/prefer-promise-reject-errors */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Multer } from 'multer';

@Injectable()
export class UploadService {
    async uploadFile(file: Express.Multer.File) {
        const isGLB =
            file.mimetype === 'model/gltf-binary' ||
            file.originalname.toLowerCase().endsWith('.glb');

        const fileName = file.originalname.split('.')[0];

        return new Promise((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            cloudinary.uploader
                .upload_stream(
                    {
                        folder: 'outfitslab',
                        resource_type: isGLB ? 'raw' : 'image',

                        public_id: isGLB ? `${fileName}.glb` : undefined,
                    },
                    (error, result) => {
                        if (error) return reject(error);

                        if (!result?.secure_url || !result?.public_id) {
                            return reject(
                                new InternalServerErrorException('Upload failed'),
                            );
                        }

                        resolve({
                            url: result.secure_url,
                            public_id: result.public_id,
                            type: isGLB ? 'model' : 'image',
                        });
                    },
                )
                .end(file.buffer);
        });
    }


    async uploadMultiple(files: Express.Multer.File[]) {
        return Promise.all(files.map((file) => this.uploadFile(file)));
    }

    async deleteFile(publicId: string, resourceType: 'image' | 'raw' = 'image') {
        return cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
        });
    }


    async updateFile(
        file: Express.Multer.File,
        oldPublicId: string,
        resourceType: 'image' | 'raw',
    ) {
        await this.deleteFile(oldPublicId, resourceType);
        return this.uploadFile(file);
    }
}