package com.example.backend.repository;

import com.example.backend.entity.Diagram;
import com.example.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DiagramRepository extends JpaRepository<Diagram, Long> {
    List<Diagram> findByOwner(User owner);
}