package com.example.satelliteai.storage;

import com.example.satelliteai.common.exception.ApplicationException;
import com.example.satelliteai.common.exception.ErrorCode;
import com.example.satelliteai.config.MinioProperties;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.GetObjectArgs;
import java.io.ByteArrayInputStream;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Configuration
@EnableConfigurationProperties(MinioProperties.class)
@ConditionalOnProperty(name = "app.minio.enabled", havingValue = "true", matchIfMissing = true)
public class MinioStorageConfig {

	@Bean
	public MinioClient minioClient(MinioProperties properties) {
		return MinioClient.builder()
				.endpoint(properties.endpoint())
				.credentials(properties.accessKey(), properties.secretKey())
				.build();
	}

	@Service
	@ConditionalOnProperty(name = "app.minio.enabled", havingValue = "true", matchIfMissing = true)
	static class MinioObjectStorageService implements ObjectStorageService {

		private final MinioClient minioClient;
		private final MinioProperties properties;

		MinioObjectStorageService(MinioClient minioClient, MinioProperties properties) {
			this.minioClient = minioClient;
			this.properties = properties;
			ensureBucket();
		}

		private void ensureBucket() {
			try {
				boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(properties.bucket()).build());
				if (!exists) {
					minioClient.makeBucket(MakeBucketArgs.builder().bucket(properties.bucket()).build());
				}
			} catch (Exception ex) {
				throw new ApplicationException(ErrorCode.STORAGE_ERROR, "Could not initialize MinIO bucket.", HttpStatus.SERVICE_UNAVAILABLE);
			}
		}

		@Override
		public void put(String objectKey, byte[] data, String contentType) {
			try {
				minioClient.putObject(PutObjectArgs.builder()
						.bucket(properties.bucket())
						.object(objectKey)
						.stream(new ByteArrayInputStream(data), data.length, -1)
						.contentType(contentType == null ? "application/octet-stream" : contentType)
						.build());
			} catch (Exception ex) {
				throw new ApplicationException(ErrorCode.STORAGE_ERROR, "Failed to store object.", HttpStatus.BAD_GATEWAY);
			}
		}

		@Override
		public byte[] get(String objectKey) {
			try (var stream = minioClient.getObject(GetObjectArgs.builder()
					.bucket(properties.bucket())
					.object(objectKey)
					.build())) {
				return stream.readAllBytes();
			} catch (Exception ex) {
				throw new ApplicationException(ErrorCode.STORAGE_ERROR, "Failed to read object.", HttpStatus.BAD_GATEWAY);
			}
		}

		@Override
		public boolean exists(String objectKey) {
			try {
				minioClient.statObject(io.minio.StatObjectArgs.builder().bucket(properties.bucket()).object(objectKey).build());
				return true;
			} catch (Exception ex) {
				return false;
			}
		}
	}
}
