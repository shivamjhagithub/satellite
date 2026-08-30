package com.example.satelliteai.storage;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = "app.minio.enabled", havingValue = "false")
public class InMemoryObjectStorageService implements ObjectStorageService {

	private final Map<String, byte[]> objects = new ConcurrentHashMap<>();

	@Override
	public void put(String objectKey, byte[] data, String contentType) {
		objects.put(objectKey, data);
	}

	@Override
	public byte[] get(String objectKey) {
		byte[] data = objects.get(objectKey);
		if (data == null) {
			throw new IllegalStateException("Missing object " + objectKey);
		}
		return data;
	}

	@Override
	public boolean exists(String objectKey) {
		return objects.containsKey(objectKey);
	}
}
