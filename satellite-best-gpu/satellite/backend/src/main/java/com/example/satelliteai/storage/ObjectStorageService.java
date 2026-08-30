package com.example.satelliteai.storage;

public interface ObjectStorageService {

	void put(String objectKey, byte[] data, String contentType);

	byte[] get(String objectKey);

	boolean exists(String objectKey);
}
