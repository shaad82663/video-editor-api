# Video Editor API

A scalable backend service for a web-based video editing platform, built with Node.js, Express.js, PostgreSQL, and FFmpeg.

## Table of Contents

- [Video Editor API](#video-editor-api)
  - [Table of Contents](#table-of-contents)
  - [Project Overview](#project-overview)
  - [Prerequisites](#prerequisites)
  - [Setup Instructions](#setup-instructions)
  - [REST API Endpoints](#rest-api-endpoints)
    - [1. Upload Video](#1-upload-video)
    - [2. Trim Video](#2-trim-video)
    - [3. Add Subtitles](#3-add-subtitles)
    - [4. Render Video](#4-render-video)
    - [5. Download Video](#5-download-video)
  - [Future Enhancements](#future-enhancements)
  - [License](#license)

## Project Overview

This project implements a backend API for a video editing platform with the following core features:

- **Video Upload**: Upload video files (.mp4, .mov) and store metadata in PostgreSQL.
- **Video Trimming**: Trim videos by specifying start and end timestamps using FFmpeg.
- **Subtitle Overlay**: Add timed subtitles to videos.
- **Video Rendering**: Combine all edits into a final video.
- **Video Download**: Retrieve the rendered video file.

## Prerequisites

Before setting up the project, ensure you have the following installed:

- [Node.js](https://nodejs.org/)
- [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager)
- [Docker](https://www.docker.com/) (for PostgreSQL and Redis)
- [FFmpeg](https://ffmpeg.org/) (installed locally)
- [npm](https://www.npmjs.com/) (Node Package Manager)
- A PostgreSQL database

## Setup Instructions

Follow these steps to set up and run the project locally:

1. **Clone the Repository**

   ```bash
   git clone <repository-url>
   cd video-editor-api
   ```

2. **Set Node Version**
   Use `nvm` to ensure the correct Node.js version:

   ```bash
   nvm use
   ```

3. **Install Dependencies**
   Install all required npm packages:

   ```bash
   npm install
   ```

4. **Run PostgreSQL via Docker**
   Start a PostgreSQL container:

   ```bash
   npm run docker
   ```

5. **Start the Server**
   Launch the Express.js server:
   ```bash
   node server.js
   ```
   The API will be available at `http://localhost:3000`.

## REST API Endpoints

The API provides the following endpoints for video editing operations. All endpoints are prefixed with `/api/v1/videos`.

| Endpoint         | Method | Description                                     |
| ---------------- | ------ | ----------------------------------------------- |
| `/upload`        | POST   | Upload a video file and store its metadata      |
| `/:id/trim`      | POST   | Trim a video by specifying start/end timestamps |
| `/:id/subtitles` | POST   | Add timed subtitles to a video                  |
| `/:id/render`    | POST   | Render the final video with all edits           |
| `/:id/download`  | GET    | Download the rendered video                     |

### 1. Upload Video

Upload a video file and save its metadata in the database.

**Request**

```bash
curl --location 'http://localhost:3000/api/v1/videos/upload' \
--header 'Content-Type: multipart/form-data' \
--form 'file=@"/path/to/your/video.mp4"'
```

**Response**

```json
{
  "message": "Video uploaded successfully",
  "video": {
    "id": "9",
    "name": "doremon",
    "duration": 180,
    "size": "17847638",
    "file_path": "1746069976659.mp4",
    "file_type": "mp4",
    "updatedAt": "2025-05-01T03:26:17.128Z",
    "createdAt": "2025-05-01T03:26:17.128Z",
    "unconfirmed_file_path": null
  }
}
```

### 2. Trim Video

Trim a video by specifying start and end timestamps.

**Request**

```bash
curl --location 'http://localhost:3000/api/v1/videos/9/trim' \
--header 'Content-Type: application/json' \
--data '{
    "start": "00:00:01",
    "end": "00:00:25"
}'
```

**Response**

```json
{
  "message": "Trim operation started",
  "editOperation": {
    "has_processed": false,
    "id": 58,
    "video_id": "9",
    "operation_type": "trim",
    "parameters": {
      "end": "00:00:25",
      "start": "00:00:01",
      "duration": 24
    },
    "file_path": "/Users/mohd.shadab/Desktop/video-editor-api/media/unconfirmed/9/trim_1746070103274.mp4",
    "updatedAt": "2025-05-01T03:28:23.274Z",
    "createdAt": "2025-05-01T03:28:23.274Z"
  }
}
```

### 3. Add Subtitles

Overlay timed subtitles on a video.

**Request**

```bash
curl --location 'http://localhost:3000/api/v1/videos/8/subtitles' \
--header 'Content-Type: application/json' \
--data '{
    "text": "1. Hello, this is a subtitle example.",
    "start": "00:00:00",
    "end": "00:00:05"
}'
```

**Response**

```json
{
  "message": "Subtitle operation logged successfully",
  "editOperation": {
    "has_processed": false,
    "id": 59,
    "video_id": "8",
    "operation_type": "subtitle",
    "parameters": {
      "end": "00:00:05",
      "text": "1. Hello, this is a subtitle example.",
      "start": "00:00:00"
    },
    "file_path": "/Users/mohd.shadab/Desktop/video-editor-api/media/unconfirmed/8/subtitle_1746070139013.mp4",
    "updatedAt": "2025-05-01T03:28:59.013Z",
    "createdAt": "2025-05-01T03:28:59.013Z"
  }
}
```

### 4. Render Video

Combine all edits into a final video.

**Request**

```bash
curl --location 'http://localhost:3000/api/v1/videos/9/render'
```

**Response**
The response is a downloadable video file (e.g., `rendered_video.mp4`).

### 5. Download Video

Download the final rendered video.

**Request**

```bash
curl --location --request GET 'http://localhost:3000/api/v1/videos/9/download' \
--header 'Content-Type: application/json' \
--data '{
    "deleteTempFile": true
}'
```

**Response**
The response is a downloadable video file (e.g., `final_video.mp4`).

## Future Enhancements

- Implement **BullMQ/Redis** for robust background job processing.
- Add support for additional video editing features (e.g., audio overlays, text/image additions).
- Integrate **Swagger** for interactive API documentation.
- Optimize FFmpeg commands for faster processing and lower resource usage.
- Add unit tests using Jest or Mocha for better code reliability.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
