-- MySQL dump 10.13  Distrib 8.4.11, for Linux (x86_64)
--
-- Host: localhost    Database: moviedb
-- ------------------------------------------------------
-- Server version	8.4.11-0ubuntu0.26.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `genres`
--

DROP TABLE IF EXISTS `genres`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `genres` (
  `genre_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`genre_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `genres`
--

LOCK TABLES `genres` WRITE;
/*!40000 ALTER TABLE `genres` DISABLE KEYS */;
INSERT INTO `genres` VALUES (1,'SF'),(3,'드라마'),(2,'전쟁'),(4,'추리');
/*!40000 ALTER TABLE `genres` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `likes`
--

DROP TABLE IF EXISTS `likes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `likes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `movie_id` bigint NOT NULL,
  `type` enum('like','favorite') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_movie_type` (`user_id`,`movie_id`,`type`),
  KEY `movie_id` (`movie_id`),
  CONSTRAINT `likes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `likes_ibfk_2` FOREIGN KEY (`movie_id`) REFERENCES `movies` (`movie_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `likes`
--

LOCK TABLES `likes` WRITE;
/*!40000 ALTER TABLE `likes` DISABLE KEYS */;
INSERT INTO `likes` VALUES (2,1,9999991,'like'),(5,1,9999992,'favorite'),(1,1,9999995,'like'),(6,2,9999993,'favorite'),(3,2,9999995,'like'),(4,3,9999995,'like'),(8,5,9999992,'like'),(7,5,9999993,'like'),(9,5,9999995,'like');
/*!40000 ALTER TABLE `likes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `movie_genres`
--

DROP TABLE IF EXISTS `movie_genres`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `movie_genres` (
  `movie_id` bigint NOT NULL,
  `genre_id` int NOT NULL,
  PRIMARY KEY (`movie_id`,`genre_id`),
  KEY `genre_id` (`genre_id`),
  CONSTRAINT `movie_genres_ibfk_1` FOREIGN KEY (`movie_id`) REFERENCES `movies` (`movie_id`) ON UPDATE CASCADE,
  CONSTRAINT `movie_genres_ibfk_2` FOREIGN KEY (`genre_id`) REFERENCES `genres` (`genre_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `movie_genres`
--

LOCK TABLES `movie_genres` WRITE;
/*!40000 ALTER TABLE `movie_genres` DISABLE KEYS */;
INSERT INTO `movie_genres` VALUES (9999991,1),(9999992,1),(9999993,1),(9999994,2),(9999995,3),(9999996,3),(9999997,4);
/*!40000 ALTER TABLE `movie_genres` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `movies`
--

DROP TABLE IF EXISTS `movies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `movies` (
  `movie_id` bigint NOT NULL,
  `title` varchar(200) NOT NULL,
  `original_title` varchar(200) DEFAULT NULL,
  `release_date` date DEFAULT NULL,
  `runtime` int DEFAULT NULL,
  `director` varchar(200) DEFAULT NULL,
  `cast` text,
  `overview` text,
  `poster_url` varchar(500) DEFAULT NULL,
  `slogan` varchar(300) DEFAULT NULL,
  `avg_rating` decimal(3,2) DEFAULT NULL,
  `review_count` int DEFAULT '0',
  PRIMARY KEY (`movie_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `movies`
--

LOCK TABLES `movies` WRITE;
/*!40000 ALTER TABLE `movies` DISABLE KEYS */;
INSERT INTO `movies` VALUES (9999991,'인터스텔라',NULL,'2014-11-06',169,'크리스토퍼 놀란','매튜 맥커너히, 앤 해서웨이, 제시카 채스테인','식량 위기에 처한 지구를 살리기 위해 우주 너머로 떠난 탐사대의 이야기. 웜홀을 통과해 새로운 거주 가능 행성을 찾아 나선다.','posters/interstellar.jpg','우리는 항상 위를 바라보았다. 그리고 그곳에 우리의 미래가 있다.',4.67,3),(9999992,'듄',NULL,'2021-10-21',155,'드니 빌뇌브','티모시 샬라메, 레베카 퍼거슨, 젠데이아','우주에서 가장 귀한 자원 스파이스를 둘러싼 아라키스 행성의 권력 다툼 속, 폴 아트레이데스의 운명이 시작된다.','posters/dune.jpg','예언은 시작되었다.',4.33,3),(9999993,'마션',NULL,'2015-10-08',144,'리들리 스콧','맷 데이먼, 제시카 채스테인, 크리스틴 위그','화성 임무 도중 사고로 홀로 남겨진 우주비행사 마크 와트니가 과학과 유머로 생존을 시도한다.','posters/martian.jpg','집으로 돌아가겠다.',4.50,2),(9999994,'덩케르크',NULL,'2017-07-20',106,'크리스토퍼 놀란','핀 화이트헤드, 톰 하디, 마크 라이런스','제2차 세계대전 덩케르크 해변에 고립된 연합군을 구출하기 위한 육·해·공의 3개 시점이 교차한다.','posters/dunkirk.jpg','생존이 곧 승리다.',4.50,2),(9999995,'쇼생크 탈출',NULL,'1995-01-28',142,'프랭크 다라본트','팀 로빈스, 모건 프리먼','억울한 누명을 쓰고 종신형을 선고받은 앤디가 쇼생크 감옥에서 펼치는 인내와 희망의 이야기.','posters/shawshank_redemption.jpg','두려움은 너를 죄수로 가두고, 희망은 너를 자유롭게 한다.',5.00,3),(9999996,'행복을 찾아서',NULL,'2006-12-07',117,'가브리엘 무치노','윌 스미스, 제이든 스미스','파산과 노숙의 위기를 겪으면서도 아들과 함께 꿈을 포기하지 않는 크리스 가드너의 실화.','posters/pursuit_of_happiness.webp','절대 포기하지 마라.',4.50,2),(9999997,'오리엔트 특급 살인',NULL,'2017-11-29',114,'마이클 그린','케네스 브레너, 페넬로페 크루즈, 윌렘 대포, 주디 덴치, 조니 뎁','세계적 명탐정 \'에르큘 포와로’는 사건 의뢰를 받고 이스탄불에서 런던으로 향하는 초호화 열차인 오리엔트 특급열차에 탑승한다.\n\n폭설로 열차가 멈춰선 밤, 승객 한 명이 잔인하게 살해당하는 사건이 발생하게 된다.\n기차 안에서 벌어진 밀실 살인, 완벽한 알리바이를 가진 13명의 용의자.\n포와로는 현장에 남겨진 단서와 용의자들의 증언을 토대로 미궁에 빠진 사건 속 진실을 찾기 위한 추리를 시작하는데…','posters/poster-1784789762262-597181.webp','13명의 완벽한 알리바이. 모두가 용의자다.',NULL,0);
/*!40000 ALTER TABLE `movies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reviews`
--

DROP TABLE IF EXISTS `reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reviews` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `movie_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `author` varchar(50) NOT NULL,
  `date` datetime NOT NULL,
  `is_critic` tinyint(1) NOT NULL DEFAULT '0',
  `rating` decimal(2,1) NOT NULL,
  `content` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_movie_date` (`movie_id`,`date`),
  CONSTRAINT `reviews_ibfk_1` FOREIGN KEY (`movie_id`) REFERENCES `movies` (`movie_id`) ON UPDATE CASCADE,
  CONSTRAINT `reviews_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reviews`
--

LOCK TABLES `reviews` WRITE;
/*!40000 ALTER TABLE `reviews` DISABLE KEYS */;
INSERT INTO `reviews` VALUES (1,9999991,1,'영화광','2025-01-10 14:30:00',0,5.0,'시간과 사랑에 대한 묵직한 여운. 마지막 씬에서 눈물이 났습니다.'),(2,9999991,2,'SF덕후','2025-01-12 09:15:00',0,5.0,'과학 고증과 스케일 모두 압도적. 여러 번 봐도 질리지 않아요.'),(3,9999991,4,'평론가','2025-01-15 20:00:00',0,4.0,'음악이 영화의 절반을 차지합니다. 짐머의 사운드트랙 최고.'),(4,9999992,2,'SF덕후','2025-02-01 11:00:00',0,5.0,'압도적인 비주얼과 사운드. 스크린에서 보길 잘했다.'),(5,9999992,3,'꿈꾸는자','2025-02-03 16:45:00',0,4.0,'세계관이 방대해서 원작을 먼저 읽으면 더 좋을 듯합니다.'),(6,9999993,1,'영화광','2025-02-10 13:20:00',0,5.0,'과학적 고증이 흥미롭고 주인공의 긍정성에 위로를 받았어요.'),(7,9999993,4,'평론가','2025-02-12 10:10:00',0,4.0,'감동과 유머가 적절히 섞인 훌륭한 생존 드라마.'),(8,9999994,2,'SF덕후','2025-02-20 18:30:00',0,4.0,'긴장감 넘치는 연출. 시간이 역순으로 교차하는 게 인상적.'),(9,9999994,3,'꿈꾸는자','2025-02-22 09:00:00',0,5.0,'전쟁의 참혹함과 인간의 연대를 동시에 보여주는 명작.'),(10,9999995,1,'영화광','2025-03-01 15:50:00',0,5.0,'희망이란 무엇인지 다시 생각하게 만드는 영화.'),(11,9999995,3,'꿈꾸는자','2025-03-03 21:15:00',0,5.0,'수없이 봐도 마지막 장면은 해방감이 어우러집니다.'),(12,9999995,4,'평론가','2025-03-05 12:40:00',0,5.0,'인내와 우정. 모두에게 추천하고 싶은 영화 1순위.'),(13,9999996,1,'영화광','2025-03-10 14:00:00',0,4.0,'실화라 더 와닿았습니다. 눈물 참기 힘들었어요.'),(14,9999996,3,'꿈꾸는자','2025-03-12 19:25:00',0,5.0,'포기하지 않는 아버지의 모습에 큰 감동을 받았습니다.'),(15,9999992,7,'관리자','2026-10-03 20:25:34',0,4.0,'great movie');
/*!40000 ALTER TABLE `reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `login_id` varchar(50) NOT NULL,
  `password` varchar(100) NOT NULL,
  `nickname` varchar(50) NOT NULL,
  `authority` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `login_id` (`login_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'cinephile','1234','영화광',0),(2,'scifan','1234','SF덕후',0),(3,'dreamer','1234','꿈꾸는자',0),(4,'critic','1234','평론가',0),(5,'kopo10','1234','wnsduf',1),(6,'test','test','test',0),(7,'admin','admin1234','관리자',1);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-03 21:07:25
